#!/usr/bin/env python3

import base64
import time
import sys
import os
import argparse
import string

import flask
import markdown
import requests

try:
	import rjsmin
except:
	class rjsminc ():
		def jsmin (self, a):
			return a
	rjsmin = rjsminc()

import sh
try:
	from sh import bower
except ImportError:
	print("Could not find required dependency bower.")
	print("Install bower from http://bower.io")
	print("(note: bower is not a python package)")

class pushd(object):
	def __init__(self, path):
		self.path = path

	def __enter__(self):
		self.cwd = os.getcwd()
		os.chdir(self.path)

	def __exit__(self, exception_type, exception_val, trace):
		os.chdir(self.cwd)

# Do a quick check to make sure bower has been run at least once
if not os.path.exists(os.path.join(os.getcwd(), 'static', 'bower_components')):
	print("Running bower...")
	with pushd('static'):
		bower("install")

# Carry a hack for new-ish firefox for Q.js
with open('static/bower_components/q/q.js') as q:
	if 'typeof StopIteration === "undefined"' in q.read():
		with pushd('static/bower_components/q'):
			print("Patching q.js...")
			sh.sed('-e', 's/typeof StopIteration === "undefined"/true/', 'q.js',
					_out='_temp.js')
			sh.mv('_temp.js', 'q.js')

DESC = """
A webserver that acts as an accessor runtime. It includes some extra templating
and intelligence to style accessors and automatically generate nice web views
for them.
"""

parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-s', '--accessor-server',
		required=True,
		help='Server to load accessors from')
parser.add_argument('-w', '--websocket-server',
		required=True,
		help='Server to tunnel websockets over')
args = parser.parse_args()

if args.accessor_server[0:4] != 'http':
	args.accessor_server = "http://" + args.accessor_server

app = flask.Flask(__name__, template_folder='jinja')

@app.template_filter('nospace')
def nospace(s):
	return s.replace(' ', '')

@app.template_filter('markdown')
def markd(s):
	return markdown.markdown(s)

def nsp(s):
	return s.replace(' ', '')

# Take accessor names and make them nice unique strings so we can have multiple
# loaded at the same time.
def clean_name(s):
	# TODO: make this better
	#return s.replace(' ', '').replace('-', '')
	return s.replace(' ', '_SPACE').replace('-', '_DASH')

def create_accessor_javascript (accessor,
                                chained_name,
                                dependency_code,
                                toplevel=False):

	# Setup the main wrapping javascript.
	# The main goal of this is to wrap the JS in the accessor in a class-like
	# object that scopes the accessor functions within the browser run time.
	# This helps prevent conflicts between accessors.
	# This wrapper also handles calling generator functions correctly and
	# providing the get, set, etc functions.
	js_module_wrapping = string.Template('''
	${accessorvariable} = (function () {

		var _inited = false;

		function get (field) {
			if (!_inited) {
				run_accessor_fn(init);
			}
			if (inited) {
				return accessor_get('${accessorname}', field);
			} else {
				return null;
			}
		}

		function get_parameter (parameter_name) {
			var parameters = {${parameterlist}};
			if (parameters[parameter_name] === undefined) {
				throw new AccessorRuntimeException('Error: parameter "'+parameter_name+'" is not defined.');
			}
			return parameters[parameter_name];
		};

		function get_dependency (dependency_name) {
			if (dependency_name in _dependencies) {
				return _dependencies[dependency_name];
			} else {
				return null;
			}
		}

		function* run_accessor_fn (accessor_fn) {
			if (typeof accessor_fn != 'undefined') {
				accessor_function_start('${accessorname}');
				try {
					if (accessor_fn != init && !_inited) {
						run_accessor_fn(init);
					}
					if (accessor_fn == init || _inited) {
						var r = accessor_fn();
						if (accessor_fun == init) {
							_inited = true;
						}
						if (r && typeof r.next == 'function') {
							yield* r;
						}
					}
				} catch(err) {
					accessor_function_stop('${accessorname}');
					console.log(err);
					throw err;
				} finally {
					accessor_function_stop('${accessorname}');
				}
			} else {
				log.warn('Accessor did not define an '+accessor_fn+' method.');
			}
		}

		var _dependencies = Object();
		${dependencies}

		${accessorjs}

		return {
			'get': get,
			'set': function (field, value) { accessor_set('${accessorname}', field, value); },
			'get_parameter': get_parameter,
			'get_dependency': get_dependency,
			'init': run_accessor_fn(init),
			'fire': run_accessor_fn(fire),
			'wrapup': run_accessor_fn(wrapup),
			${functionlist}
		}
	})();
	''')

	# Each port can have a function, make them public here.
	function_list = ''
	for port in accessor['ports']:
		function_list += string.Template('''
'${portname}': function* () { yield* run_accessor_fn(${portname}); },
''').substitute(portname=port['name'])

	# Parameters end up being implemented as a pre-constructed object that
	# is referenced at runtime.
	parameter_list = ''
	if 'parameters' in accessor:
		for parameter in accessor['parameters']:
			parameter_list += "'{parametername}':'{parametervalue}',"\
				.format(parametername=parameter['name'], parametervalue=parameter['value'])

	# Make the correct variable instantation based on if this is the top level
	# accessor or a dependency
	if toplevel:
		accessor_variable = 'var {}'.format(accessor['clean_name'])
	else:
		accessor_variable = '_dependencies.{}'.format(accessor['name'])


	js = js_module_wrapping.substitute(accessorname=chained_name,
	                                   accessorvariable=accessor_variable,
	                                   accessorjs=accessor['code'],
	                                   dependencies=dependency_code,
	                                   functionlist=function_list,
	                                   parameterlist=parameter_list)
	return rjsmin.jsmin(js)


# This is a recursive function that loops through accessors and dependencies
# to generate all of the needed JS.
def create_javascript (accessor, chained_name='', toplevel=True):
	chained_name += accessor['clean_name']

	dep_code = ''
	if 'dependencies' in accessor:
		for dependency in accessor['dependencies']:
			dependency['clean_name'] = clean_name(dependency['name'])
			dep_code += create_javascript(dependency, chained_name, False)

	return create_accessor_javascript(accessor, chained_name, dep_code, toplevel)



# This function adds a bunch of javascript to the code section of the accessor
# to make the browser runtime work.
def get_accessors (url):

	r = requests.get(url)
	if r.status_code != 200:
		return flask.jsonify(**{'status': 'error'})

	accessor_list = r.json()

	accessors = {'accessors': []}

	for accessor_url in accessor_list['accessors']:
		if '?' in accessor_url:
			i = accessor_url.index('?')
			accessor_url = accessor_url[:i] + '.json' + accessor_url[i:]
		else:
			accessor_url += '.json'
		get_url = '{}/accessor{}'.format(args.accessor_server, accessor_url)
		print("GET {}".format(get_url))
		r2 = requests.get(get_url)
		if r2.status_code == 200:
			accessor = r2.json()
			accessor['clean_name'] = clean_name(accessor['name'])

			# Make sure the 'display_name' key exists to make the JS frontend
			# easier.
			for port in accessor['ports']:
				if 'display_name' not in port:
					port['display_name'] = port['name']

			# Do the code
			accessor['code'] = create_javascript(accessor)

			if accessor['name'] == "Brad-Pat Hue":
				print(accessor['code'])

			accessor['html'] = flask.render_template('ports.jinja', accessor=accessor)
			accessors['accessors'].append(accessor)

	return flask.jsonify(**accessors)


@app.route('/location/')
def location_anywhere():
	return get_accessors('{}/accessors/accessors.json'.format(args.accessor_server))


@app.route('/location/<path:location>')
def location(location):
	print(location)

	# Get the list of valid accessors for the given location
	return get_accessors('{}/accessors/{}/accessors.json'.format(args.accessor_server, location))


@app.route('/')
def accessor():

	locations = []
	locations.append({'name': 'University of Michigan - 4908 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/4908'})
	locations.append({'name': 'University of Michigan - 2909 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/2909'})
	locations.append({'name': 'Anywhere',
	                  'path': '/'})

	return flask.render_template('accessors.jinja',
	                             locations=locations,
	                             ws_server_address=args.websocket_server)


# This is some nonsense to bypass the cross-origin policy nonsense
@app.route('/proxy', methods=['POST', 'GET', 'PUT'])
def proxy():
	url = base64.b64decode(flask.request.args.get('url')).decode('ascii')
	method = flask.request.args.get('method')

	if method.lower() == 'get':
		r = requests.get(url)
		return r.text
	elif method.lower() == 'post':
		print('POST: {}, {}'.format(url, flask.request.data))
		r = requests.post(url, flask.request.data)
		print(r.text)
		return ''
	elif method.lower() == 'put':
		print('PUT: {}, {}'.format(url, flask.request.data))
		r = requests.put(url, flask.request.data)
		print(r.text)
		return ''



app.run(host='0.0.0.0', debug=True)
