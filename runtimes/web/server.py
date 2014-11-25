#!/usr/bin/env python3

import base64
import time
import sys
import os
import argparse
import string
import urllib.parse

import flask
import markdown
import requests
import rjsmin

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

def clean(s):
	# TODO: make this better
	return s.replace(' ', '').replace('-', '')

def create_accessor_javascript (accessor, meta=False):
	js_module_wrapping = string.Template('''
	var ${accessorname} = (function () {

		ws_server_address = '${websocket_server}';

		function get (field) {
			return accessor_get('${accessorname}', field);
		};

		function set (field, value) {
			accessor_set('${accessorname}', field, value);
		};

		function get_parameter (parameter_name) {
			var parameters = {${parameterlist}};
			if (parameters[parameter_name] === undefined) {
				throw new AccessorRuntimeException('Error: parameter "'+parameter_name+'" is not defined.');
			}
			return parameters[parameter_name];
		};

		${accessorjs}

		function* run_accessor (accessor_fn, accessor_name) {
			accessor_function_start(accessor_name);
			try {
				var r = accessor_fn();
				if (r && typeof r.next == 'function') {
					yield* r;
				}
			} catch(err) {
				console.log(err);
			} finally {
				accessor_function_stop(accessor_name);
			}
		}

		return {
			'get': get,
			'set': set,
			'get_parameter': get_parameter,
			'init': function* () {
						if (typeof init != 'undefined') {
							yield* run_accessor(init, '${accessorname}');
						} else {
							log.warn("Accessor did not define an init() method");
						}
					},
			'fire': function* () {
						if (typeof fire != 'undefined') {
							yield* run_accessor(fire, '${accessorname}');
						} else {
							log.warn("Accessor did not define an fire() method");
						}
					},
			'wrapup': function* () {
						if (typeof wrapup != 'undefined') {
							yield* run_accessor(wrapup, '${accessorname}');
						} else {
							log.warn("Accessor did not define an wrapup() method");
						}
					},
			${functionlist}
		}
	})();
	''')

	function_list = ''
	for port in accessor['ports']:
		port['clean_name'] = clean(port['name'])
		function_list += \
''''{portname}': function* () {{
	if (typeof {portname} != 'undefined') {{
		accessor_function_start('{accessorname}');
		try {{
			var r = {portname}.apply(this, arguments);
			if (r && typeof r.next == 'function') {{
				yield* r;
			}}
		}} catch (err) {{
			console.log(err);
		}} finally {{
			accessor_function_stop('{accessorname}');
		}}
	}} else {{
		if (typeof fire != 'undefined') {{
			yield* run_accessor(fire, '{accessorname}');
		}} else {{
			log.warn("Accessor did not define an fire() method");
		}}
	}}
}},\n'''.format(accessorname=accessor['clean_name'], portname=port['clean_name'])

	parameter_list = ''
	if 'parameters' in accessor:
		for parameter in accessor['parameters']:
			parameter_list += "'{parametername}':'{parametervalue}',"\
				.format(parametername=parameter['name'], parametervalue=parameter['value'])

	js = js_module_wrapping.substitute(websocket_server=args.websocket_server,
	                                   accessorname=accessor['clean_name'],
	                                   accessorjs=accessor['code'],
	                                   functionlist=function_list,
	                                   parameterlist=parameter_list)
	accessor['code'] = rjsmin.jsmin(js)




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
			accessor['clean_name'] = clean(accessor['name'])

			# Do the code
			create_accessor_javascript(accessor)

			if 'dependencies' in accessor:
				for dependency in accessor['dependencies']:
					dependency['clean_name'] = clean(dependency['name'])
					create_accessor_javascript(dependency)


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


@app.route('/accessor')
def accessor():

	locations = []
	locations.append({'name': 'University of Michigan - 4908 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/4908'})
	locations.append({'name': 'University of Michigan - 2909 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/2909'})
	locations.append({'name': 'Anywhere',
	                  'path': '/'})

	return flask.render_template('accessors.jinja', locations=locations)


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
