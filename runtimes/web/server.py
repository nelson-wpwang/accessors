#!/usr/bin/env python3


import argparse
import base64
import json
import os
import random
import re
import string
import sys
import time
import uuid

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
parser.add_argument('-s', '--accessor-host-server',
		required=True,
		help='Server to load accessors from')
parser.add_argument('-r', '--accessor-runtime-server',
		required=True,
		help='Server that can execute servers')
args = parser.parse_args()

if args.accessor_host_server[0:4] != 'http':
	args.accessor_host_server = "http://" + args.accessor_host_server

if args.accessor_runtime_server[0:4] != 'http':
	args.accessor_runtime_server = "http://" + args.accessor_runtime_server

app = flask.Flask(__name__, template_folder='jinja')

@app.template_filter('nospace')
def nospace(s):
	return s.replace(' ', '')

@app.template_filter('markdown')
def markd(s):
	return markdown.markdown(s)

def nsp(s):
	return s.replace(' ', '')

# # Take accessor names and make them nice unique strings so we can have multiple
# # loaded at the same time.
# def clean_name (s):
# 	pattern = re.compile('[\W_]+')
# 	out = pattern.sub('', s)
# 	out += ''.join(random.choice(string.ascii_uppercase + string.digits) for _ in range(10))
# 	out = 'a' + out # easiest way to force accessor names to start with letter
# 	return out

# # Recursively add names that we can use in HTML and JS for each accessor
# # and its dependencies.
# def clean_names (accessor):
# 	accessor['clean_name'] = clean_name(accessor['name'])

# 	if 'dependencies' in accessor:
# 		for dep in accessor['dependencies']:
# 			clean_names(dep)


# def create_accessor_javascript (accessor,
#                                 chained_name,
#                                 dependency_code,
#                                 toplevel=False):

# 	# Setup the main wrapping javascript.
# 	# The main goal of this is to wrap the JS in the accessor in a class-like
# 	# object that scopes the accessor functions within the browser run time.
# 	# This helps prevent conflicts between accessors.
# 	# This wrapper also handles calling generator functions correctly and
# 	# providing the get, set, etc functions.
# 	js_module_wrapping = string.Template('''
# 	${accessorvariable} (function () {

# 		var _inited = false;

# 		function create_port () {
# 			/* no-op, happened upstream */
# 		}

# 		${get_set}

# 		function get_parameter (parameter_name) {
# 			if (_parameters[parameter_name] === undefined) {
# 				throw new AccessorRuntimeException('Error: parameter "'+parameter_name+'" is not defined.');
# 			}
# 			return _parameters[parameter_name];
# 		};

# 		function load_dependency (dependency_path, dep_params) {
# 			if (dependency_path in _dependencies) {
# 				var dep_str = _dependencies[dependency_path];
# 				var dep = eval(dep_str);
# 				for (key in dep_params) {
# 					dep._set_parameter(key, dep_params[key]);
# 				}
# 				dep._set_parameter = 'undefined';
# 				return dep;
# 			} else {
# 				return null;
# 			}
# 		}

# 		function error (error_msg) {
# 			throw new Error(error_msg);
# 		}

# 		function* run_accessor_fn (accessor_fn) {
# 			accessor_function_start('${accessorname}');
# 			try {
# 				if (typeof init == 'undefined') {
# 					// If there is no init function, then we were inited
# 					// from the start.
# 					_inited = true;
# 				}
# 				if (!_inited && accessor_fn != init) {
# 					// If we are not inited and we are not running init,
# 					// run init now.
# 					yield* run_accessor_fn(init);
# 				}
# 				if (_inited || accessor_fn == init) {
# 					var subargs = Array.prototype.slice.call(arguments, 1);
# 					var r = accessor_fn.apply(this, subargs);
# 					if (typeof init != 'undefined' && accessor_fn == init) {
# 						_inited = true;
# 					}
# 					if (r && typeof r.next == 'function') {
# 						yield* r;
# 					}
# 				}
# 			} catch(err) {
# 				accessor_function_stop('${accessorname}');
# 				console.log(err);
# 				${error_handle}
# 			} finally {
# 				accessor_function_stop('${accessorname}');
# 			}
# 		}


# 		var _parameters = JSON.parse('${parameters}');

# 		var _dependencies = Object();
# 		${dependencies}

# 		${accessorjs}

# 		return {
# 			'_set_parameter': function (name, value) { _parameters[name] = value; },
# 			'get': get,
# 			'set': set,
# 			'get_parameter': get_parameter,
# 			'load_dependency': load_dependency,
# 			'init': function* () { if (typeof init != 'undefined') { yield* run_accessor_fn(init) } else { _inited = true; } },
# 			'fire': function* () { if (typeof fire != 'undefined') { yield* run_accessor_fn(fire) } },
# 			'wrapup': function* () { if (typeof wrapup != 'undefined') { yield* run_accessor_fn(wrapup) } },
# 			${functionlist}
# 		}
# 	})();
# 	''')

# 	if toplevel:
# 		get_set = string.Template('''
# 		function get (field) {
# 			if (!_inited) {
# 				if (typeof init != 'undefined') {
# 					yield* run_accessor_fn(init);
# 				} else {
# 					_inited = true;
# 				}
# 			}
# 			if (_inited) {
# 				return accessor_get('${accessorname}', field);
# 			} else {
# 				return null;
# 			}
# 		}

# 		function set (field, value) {
# 			accessor_set('${accessorname}', field, value);
# 		}
# 		''').substitute(accessorname=chained_name)

# 		error_handle = 'accessor_exception("{}", err);'.format(chained_name)

# 	else:
# 		get_set = '''
# 		var _ports = Object();

# 		function get (field) {
# 			if (!_inited) {
# 				run_accessor_fn(init);
# 			}
# 			if (_inited) {
# 				return _ports[field];
# 			} else {
# 				return null;
# 			}
# 		}

# 		function set (field, value) {
# 			_ports[field] = value;
# 		}
# 		'''

# 		error_handle = 'throw err;'

# 	# Each port can have a function, make them public here.
# 	function_list = ''
# 	for port in accessor['ports']:
# 		function_list += string.Template('''
# '${portname}': function* () {
# 	if (typeof ${portname} != 'undefined') {
# 		yield* run_accessor_fn.apply(this, [${portname}].concat(Array.prototype.slice.call(arguments)));
# 	}
# },
# ''').substitute(portname=port['name'])

# 	# Parameters end up being implemented as a pre-constructed object that
# 	# is referenced at runtime.
# 	parameter_obj = {}
# 	for parameter in accessor['parameters']:
# 		if parameter['value']:
# 			parameter_obj[parameter['name']] = parameter['value']
# 		else:
# 			parameter_obj[parameter['name']] = None

# 	# Make the correct variable instantation based on if this is the top level
# 	# accessor or a dependency
# 	accessor_variable = ''
# 	if toplevel:
# 		accessor_variable = 'var {} = '.format(accessor['clean_name'])

# 	js = js_module_wrapping.substitute(accessorname=chained_name,
# 	                                   accessorvariable=accessor_variable,
# 	                                   accessorjs=accessor['code'],
# 	                                   dependencies=dependency_code,
# 	                                   functionlist=function_list,
# 	                                   parameters=json.dumps(parameter_obj),
# 	                                   get_set=get_set,
# 	                                   error_handle=error_handle)
# 	return rjsmin.jsmin(js)



# # This is a recursive function that loops through accessors and dependencies
# # to generate all of the needed JS.
# def create_javascript (accessor, chained_name='', toplevel=True):
# 	chained_name += accessor['clean_name']

# 	dep_code = ''
# 	if 'dependencies' in accessor:
# 		for dependency in accessor['dependencies']:
# 			js = create_javascript(dependency, chained_name, False)
# 			escaped = json.dumps(js)
# 			dep_code += "_dependencies['{}'] = {};".format(dependency['path'], escaped)

# 	return create_accessor_javascript(accessor, chained_name, dep_code, toplevel)

# # This is also a recursive function that propagates parameters to accessors
# # and its dependencies.
# def set_accessor_parameters (parameters, accessor, chained_name=''):
# 	for parameter in accessor['parameters']:
# 		name = chained_name + parameter['name']

# 		if name in parameters:
# 			parameter['value'] = parameters[name]
# 			del parameters[name]
# 		elif 'default' in parameter:
# 			parameter['value'] = parameter['default']
# 		elif 'value' not in parameter:
# 			print('ERROR: parameter {} in accessor {} not set!'\
# 				.format(name, accessor['name']))
# 			parameter['value'] = ''

# 	if 'dependencies' in accessor:
# 		for dep in accessor['dependencies']:
# 			next_name = chained_name + dep['name'] + '.'
# 			set_accessor_parameters(parameters, dep, next_name)


def get_devices (url):

	# r = requests.get(url)
	# if r.status_code != 200:
	# 	return flask.jsonify(**{'status': 'error'})

	# device_list = r.json()


	device_list = [
		{
			"name": "umhue01",
			"path": "/lighting/hue/huesingle",
			"parameters": {
				"bridge_url": "http://4908hue.eecs.umich.edu",
				"username": "lab11in4908",
				"bulb_name": "Brad"
			}
		}
	]

	devices = []

	for device in device_list:

		accessor_path = device['path']

		get_url = '{}/accessor{}.json'.format(args.accessor_host_server, accessor_path)
		print("GET {}".format(get_url))
		r2 = requests.get(get_url)
		if r2.status_code == 200:
			accessor = r2.json()

			print(accessor)

			accessor['uuid'] = uuid.uuid4()
			accessor['device_name'] = device['name']
			accessor['device_group'] = url
			accessor['html'] = flask.render_template('ports.jinja', accessor=accessor)

			devices.append(accessor)

# 			# Create unique names without spaces or symbols that can be used as
# 			# javascript objects.
# 			clean_names(accessor)

# 			# Set the parameters
# 			if 'parameters' in accessor_item:
# 				set_accessor_parameters(accessor_item['parameters'], accessor)
# 				# Display errors if parameters are set that don't exist
# 				for name,value in accessor_item['parameters'].items():
# 					print('ERROR: parameter "{}" was specified as "{}" but that \
# parameter does not exist in the accessor {}'.format(name, value, accessor['name']))
# 				# Validate that all required paramters have values
# 				for parameter in accessor['parameters']:
# 					if parameter.get('required', True) == False:
# 						# This is the only case where a parameter doesn't have
# 						# to have a value
# 						if 'value' not in parameter:
# 							parameter['value'] = None
# 					elif 'value' not in parameter:
# 						print('ERROR: parameter "{}" was not set'.format(parameter['name']))


# 			# Make sure the 'display_name' key exists to make the JS frontend
# 			# easier.
# 			for port in accessor['ports']:
# 				if 'display_name' not in port:
# 					port['display_name'] = port['name']

# 			# Parse what functions were defined in the accessor to determine
# 			# how to display the interface.
# 			re_fn_name = re.compile(r'\bfunction\b[*]?[ \t]*([a-zA-Z0-9_\t]*)[ \t]*\(', re.MULTILINE)
# 			function_names = re.findall(re_fn_name, accessor['code'])

# 			accessor['display_fire_button'] = False
# 			for port in accessor['ports']:
# 				if port['name'] in function_names:
# 					port['has_function'] = True
# 				elif port['direction'] in ['input', 'inout']:
# 					port['has_function'] = False
# 					accessor['display_fire_button'] = True
# 			if 'fire' in function_names:
# 				accessor['display_fire_button'] = True

# 			# Do the code
# 			accessor['code'] = create_javascript(accessor)

# 			accessor['html'] = flask.render_template('ports.jinja', accessor=accessor)
# 			accessors['accessors'].append(accessor)

	return flask.jsonify(**{'devices': devices})



@app.route('/group/<path:group>')
def group(group):
	print(group)

	# Get the list of valid accessors for the given location
	return get_devices('{}/{}'.format(args.accessor_runtime_server, group))


@app.route('/')
def accessor():

	groups = []
	groups.append({'name': 'My Color Demo',
	               'path': '/misc/mycolor'})
	groups.append({'name': 'Anywhere',
	               'path': '/'})

	return flask.render_template('accessors.jinja',
	                             groups=groups,
	                             accessor_runtime_server=args.accessor_runtime_server)



app.run(host='0.0.0.0', debug=True)
