#!/usr/bin/env python3

import logging
log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

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

# import sh
# try:
# 	from sh import bower
# except ImportError:
# 	print("Could not find required dependency bower.")
# 	print("Install bower from http://bower.io")
# 	print("(note: bower is not a python package)")

# class pushd(object):
# 	def __init__(self, path):
# 		self.path = path

# 	def __enter__(self):
# 		self.cwd = os.getcwd()
# 		os.chdir(self.path)

# 	def __exit__(self, exception_type, exception_val, trace):
# 		os.chdir(self.cwd)

# Do a quick check to make sure bower has been run at least once
# if not os.path.exists(os.path.join(os.getcwd(), 'static', 'bower_components')):
# 	print("Running bower...")
# 	with pushd('static'):
# 		bower("install")


DESC = """
A webserver that acts as an accessor runtime. It includes some extra templating
and intelligence to style accessors and automatically generate nice web views
for them.
"""

parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-r', '--accessor-runtime-server',
	default='http://localhost:5577',
	help='Server that can execute servers')
args = parser.parse_args()


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


@app.route('/device/<name>')
def get_devices (name):

	url = '{}/device/{}'.format(args.accessor_runtime_server, name)
	accessor = requests.get(url).json()

	for port in accessor['ports']:
		port['uuid'] = uuid.uuid4()

	accessor['uuid'] = uuid.uuid4()
	accessor['device_name'] = name
	accessor['html'] = flask.render_template('ports.jinja', accessor=accessor)

	return flask.jsonify(**accessor)


@app.route('/accessor/<path:accessor>')
def accessor_ir(accessor):
	print(accessor)

	url = '{}/accessor/{}'.format(args.accessor_runtime_server, accessor)
	return json.dumps(requests.get(url).json())


@app.route('/')
def accessor():

	url = args.accessor_runtime_server + '/list/active'
	active_accessors = requests.get(url).json()

	url = args.accessor_runtime_server + '/list/all'
	all_accessors = requests.get(url).json()

	return flask.render_template('accessors.jinja',
	                             active_accessors=active_accessors,
	                             all_accessors=all_accessors,
	                             accessor_runtime_server=args.accessor_runtime_server)


log.info("Using accessor runtime server at %s", args.accessor_runtime_server)

app.run(host='0.0.0.0', debug=True)
