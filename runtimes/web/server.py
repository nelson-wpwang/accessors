#!/usr/bin/env python3

import base64
import sys
import os
import argparse
import string
import urllib.parse

import flask
import markdown
import requests
import rjsmin

# Do a quick check to make sure bower has been run at least once
if not os.path.exists(os.path.join(os.getcwd(), 'static', 'bower_components')):
	print("ERR: No static/bower_components directory found.")
	print("     Is this a new checkout? Did you forget to run `bower install`?")
	sys.exit(1)

DESC = """
A webserver that acts as an accessor runtime. It includes some extra templating
and intelligence to style accessors and automatically generate nice web views
for them.
"""

parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-s', '--accessor-server',
		required=True,
		help='Server to load accessors from')
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

# This function adds a bunch of javascript to the code section of the accessor
# to make the browser runtime work.
def get_accessors (url):
	js_module_wrapping = string.Template('''
	var ${accessorname} = (function () {

		function get (field) {
			return $$('#${accessorname}'+field).val();
		};

		function set (field, value) {
			var accessor_input = $$('#${accessorname}'+field);

			if (accessor_input.attr('type') == 'checkbox') {
				if (value) {
					accessor_input.prop('checked', true);
				} else {
					accessor_input.prop('checked', false);
				}

			} else if (accessor_input.attr('type') == 'text') {
				accessor_input.val(value);

			} else if (accessor_input.prop('tagName') == 'SELECT') {
				$$('#${accessorname}'+field+' option:eq('+value+')').prop('selected', true);

			} else if (accessor_input.prop('tagName') == 'SPAN') {
				accessor_input.text(value);

			}
		};

		function get_parameter (parameter_name) {
			var parameters = {${parameterlist}};
			return parameters[parameter_name];
		};

		${accessorjs}

		return {
			'init':   function () { if (typeof init == 'function') { init(); } },
			'fire':   function () { if (typeof fire == 'function') { fire(); } },
			'wrapup': function () { if (typeof wrapup == 'function') { wrapup(); } },
			${functionlist}
		}
	})();
	''')

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
			accessor['html'] = flask.render_template('ports.jinja', accessor=accessor)

			# Do the code
			function_list = ''
			for port in accessor['ports']:
				function_list += \
"'{portname}': function () {{ if (typeof {portname} == 'function') {{ {portname}.apply(this, arguments); }} else {{ fire(); }} }},\n".format(portname=nsp(port['name']))

			parameter_list = ''
			if 'parameters' in accessor:
				for parameter in accessor['parameters']:
					parameter_list += "'{parametername}':'{parametervalue}',"\
						.format(parametername=parameter['name'], parametervalue=parameter['value'])

			js = js_module_wrapping.substitute(accessorname=accessor['clean_name'],
			                                   accessorjs=accessor['code'],
			                                   functionlist=function_list,
			                                   parameterlist=parameter_list)
			accessor['code'] = rjsmin.jsmin(js)

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
