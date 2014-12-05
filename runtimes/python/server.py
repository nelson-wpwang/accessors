#!/usr/bin/env python3

import base64
import pprint
import time
import sys
import os
import argparse
import string
import urllib.parse

try:
	import bond
except ImportError:
	print("Missing required package 'python-bond'")
	raise
import semver
import sh
import markdown
import requests

try:
	node_version = str(sh.node('--version')).strip()
except sh.CommandNotFound:
	print("This tool requires that `node` is installed.")
	print("Please get a copy from https://nodejs.org")
	sys.exit(1)

if node_version[0] == 'v':
	node_version = node_version[1:]
if not semver.match(node_version, ">=0.11.0"):
	print("This tool requires node version >=0.11.0")
	print("You have node version {} installed.".format(node_version))
	print("Please update your node installation")
	print("(You can use `nvm` to do this easily: github.com/creationix/nvm)")
	print("(then run `nvm use 0.11`)")
	sys.exit(1)

import logging
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

DESC = """
A command line interface to accessors as a step towards a more general python
accessor library / runtime.
"""

parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-s', '--accessor-server',
		required=True,
		help='Server to load accessors from')
args = parser.parse_args()

if args.accessor_server[0:4] != 'http':
	args.accessor_server = "http://" + args.accessor_server
if args.accessor_server[-1] == '/':
	args.accessor_server = args.accessor_server[:-1]


def get_locations():
	locations = []
	locations.append({'name': 'University of Michigan - 4908 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/4908'})
	locations.append({'name': 'University of Michigan - 2909 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/2909'})
	locations.append({'name': 'Anywhere',
	                  'path': '/'})

	return locations


def get_all_accessors_from_location (path):
	url = args.accessor_server + '/accessors'
	if path[0] != '/':
		url += '/'
	url += path
	if url[-1] != '/':
		url += '/'
	url += 'accessors.json'
	r = requests.get(url)
	if r.status_code != 200:
		raise NotImplementedError("Failed to get accessor list:\n\t{}".format(url))

	accessor_list = r.json()
	accessors = []

	for accessor_url in accessor_list['accessors']:
		if '?' in accessor_url:
			i = accessor_url.index('?')
			accessor_url = accessor_url[:i] + '.json' + accessor_url[i:]
		else:
			accessor_url += '.json'
		get_url = '{}/accessor{}'.format(args.accessor_server, accessor_url)
		logging.debug("GET {}".format(get_url))
		r2 = requests.get(get_url)
		if r2.status_code == 200:
			accessors.append(Accessor(r2.json()))
		else:
			raise NotImplementedError("Failed to get accessor: {}".format(get_url))

	return accessors

class Port():
	@staticmethod
	def create(port, accessor):
		# Default type is <string>
		if 'type' not in port:
			port['type'] = 'string'

		if port['direction'] == 'input':
			return InputPort(port, accessor)
		elif port['direction'] == 'output':
			return OutputPort(port, accessor)
		elif port['direction'] == 'inout':
			return InoutPort(port, accessor)
		else:
			raise NotImplementedError("Unknown port direction: {}".\
					format(port['direction']))

	class SelectType():
		def __init__(self, options):
			self.options = options

		def coerce(value):
			if value not in options:
				raise NotImplementedError("Illegal value >{}< for options >{}<".\
						format(value, options))
			return str(value)

		def __call__(self, value):
			return self.coerce(value)

		def __str__(self):
			return 'select: {}'.format(','.join(self.options))

	TYPE_MAP = {
			'button': None,
			'bool': bool,
			'numeric': float,
			'integer': int,
			'string': str,
			'color': str, #FIXME
			}

	def __init__(self, port, accessor):
		self.accessor = accessor

		self.accessor_name = port['name']

		self.python_name = port['name'].lower().replace(' ','_').replace('-','_')

		if port['type'] == 'select':
			self.type = Port.SelectType(port['options'])
		else:
			self.type = Port.TYPE_MAP[port['type']]

	def __str__(self):
		return '<{}> {}(<{}>)'.format(self.direction, self.python_name, str(self.type))


	# For the runtime use, allow anything to '_get' regardless of port direction
	# since the runtime may want to read back the values it _set
	def _get(self):
		return self.value

class InputPort(Port):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'input'

	# For the accessor use
	def get(self):
		return self.type(self.value)

	# For the runtime use
	def _set(self, value):
		self.value = value
		if self.accessor._js is None:
			self.accessor._init()
		try:
			self.accessor._js.call(self.accessor_name, value)
		except bond.RemoteException:
			# TODO distinguish missing fn from other exception
			log.debug("%s: pre-fire", self)
			self.accessor._js.eval('fire().next()')
			log.debug("%s: post-fire", self)

class OutputPort(Port):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'output'

	# For the accessor use
	def set(self, value):
		self.value = self.type(value)

class InoutPort(InputPort,OutputPort):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'inout'



class Accessor():
	def __init__(self, json):
		# Required Keys
		self.name = json['name']
		self.version = json['version']

		log.debug("Creating new accessor: %s", self.name)

		if 'author' in json:
			self.author = json['author']
		else:
			self.author = None

		if 'description' in json:
			self.description = json['description']
		else:
			self.description = None

		if 'parameters' in json:
			self.parameters = json['parameters']
		else:
			self.parameters = []

		self.ports = []
		for port in json['ports']:
			self.ports.append(Port.create(port, self))

		if 'code' not in json:
			raise NotImplementedError("Accessor without code?")
		self.code = json['code']

		# Lazy-bind accessor init until first use
		self._js = None

		self._strict_attr_enforcement = True

	def _init(self):
		log.debug("%s: creating JS runtime", self.name)
		self._js = bond.make_bond('JavaScript', 'node', ['--harmony'])

		log.debug("%s: loading accessor", self.name)
		self._js.eval_block(self.code)

		self._init_runtime()

		log.debug("%s: running init", self.name)
		ret = self._js.eval("init()");
		log.debug("%s: init ret %r", self.name, ret)

	def __str__(self):
		return self.name

	def __repr__(self):
		return "<Accessor: {}>".format(self.name)

	def __getattribute__(self, attr):
		if attr != 'ports' and hasattr(self, 'ports'):
			for port in self.ports:
				if attr == port.python_name:
					return port._get()
		return object.__getattribute__(self, attr)

	def __setattr__(self, attr, value):
		if hasattr(self, 'ports'):
			for port in self.ports:
				if attr == port.python_name:
					port._set(value)
					return
		if hasattr(self, '_strict_attr_enforcement') and self._strict_attr_enforcement:
			if not hasattr(self, attr):
				raise AttributeError("%r object has no attribute %r" %
						(self, attr))
		return object.__setattr__(self, attr, value)

	def _init_runtime(self):
		### GENERAL UTILITY

		def version(set_to):
			if set_to != "0.1.0":
				log.warn("Request for runtime version %s ignored", set_to)
			return "0.1.0"
		self._js.export(version)

		def do_log(level, msg):
			f = getattr(log, level)
			f(msg)
			if level == 'criticl':
				raise NotImplementedError("runtime: log.critical")
		self._js.eval_block('''\
log = Object();
log.debug = function (msg) { _log('debug', msg); };
log.info  = function (msg) { _log('info',  msg); };
log.warn  = function (msg) { _log('warn',  msg); };
log.error = function (msg) { _log('error', msg); };
log.criticl = function (msg) { _log('critical', msg); };
''')
		self._js.export(do_log, "_log")

		#TODO time.sleep

		#TODO time.run_later


		### ACCESSOR INTERFACE AND PROPERTIES

		def get(port_name):
			for port in self.ports:
				if port_name == port.accessor_name:
					return port.get()
		self._js.export(get)

		def set(port_name, value):
			for port in self.ports:
				if port_name == port.accessor_name:
					port.set(value)
					return
		self._js.export(set)

		def get_parameter(parameter_name):
			return self.parameters['parameter_name']
		self._js.export(get_parameter)


		### SOCKETS

		def runtime_socket(family, sock_type):
			raise NotImplementedError("socket")
		self._js.export(runtime_socket, '_socket')
		self._js.eval_block('''\
socket = Object();
socket.socket = _socket;
''')


		### HTTP Requests

		def http_request(url, method, properties=None, body=None, timeout=None):
			raise NotImplementedError("http_request")
		self._js.export(http_request, '_http_request')

		def http_readURL(url):
			log.debug("%s: readUrl('%s')", self.name, url)
			r = requests.get(url)
			if r.status_code != 200:
				raise NotImplementedError("request code != 200")
			return r.text
		self._js.export(http_readURL, '_http_readURL')

		self._js.eval_block('''\
http = Object();
http.request = _http_request;
http.readURL = function* (url) { return _http_readURL(url); };
''')

accessors = {}
for location in get_locations():
	logging.debug('{} :: {}'.format(location['name'], location['path']))
	accessors[location['name']] = get_all_accessors_from_location(location['path'])

try:
	stocktick = accessors['Anywhere'][0]
	for symbol in ['GOOG', 'MSFT', 'YHOO']:
		stocktick.stock_symbol = symbol
		print("Stock {} price ${}".format(stocktick.stock_symbol, stocktick.price))
finally:
	# Hack until I undertsand bond better
	sh.killall('node')
