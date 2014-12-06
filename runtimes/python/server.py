#!/usr/bin/env python3

import base64
import pprint
import time
import sys
import os
import socket
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
	accessors = {}

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
			accessor = Accessor(accessor_url, r2.json())
			accessors[accessor._raw_name] = accessor
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
			log.debug("%s: call accesor fn: %s(%s)", self, self.accessor_name, value)
			r = self.accessor._js.call('_port_call', self.accessor_name, value)
			log.debug("%s: return %s", self, r)
			log.debug("%s: end accesor fn: %s(%s)", self, self.accessor_name, value)
		except bond.RemoteException:
			# TODO distinguish missing fn from other exception
			log.debug("%s: no port fn, default to fire", self)
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
	def __init__(self, url, json):
		# Save a copy of the url, just in case
		self._url = url
		self._raw_name = url.split('.json')[0].split('/')[-1]

		# Required Keys
		self._name = json['name']
		self._version = json['version']

		log.debug("Creating new accessor: %s", self._name)

		if 'author' in json:
			self._author = json['author']
		else:
			self._author = None

		if 'description' in json:
			self._description = json['description']
		else:
			self._description = None

		self._ports = []
		for port in json['ports']:
			self._ports.append(Port.create(port, self))

		self._parameters = {}
		if 'parameters' in json:
			for parameter in json['parameters']:
				if 'value' in parameter:
					self._parameters[parameter['name']] = parameter['value']
				elif 'default' in parameter:
					self._parameters[parameter['name']] = parameter['default']

		if 'code' not in json:
			raise NotImplementedError("Accessor without code?")
		self._code = json['code']

		# Lazy-bind accessor init until first use
		self._js = None

	def _init(self):
		'''Call accessor init method'''
		if self._js is not None:
			raise RuntimeError("Multiple requests to init accessor")

		log.debug("%s: creating JS runtime", self._name)
		self._js = bond.make_bond('JavaScript', 'node', ['--harmony'])

		log.debug("%s: loading accessor", self._name)
		self._js.eval_block(self._code)

		self._init_runtime()

		log.debug("%s: running init", self._name)
		ret = self._js.eval("init()");
		log.debug("%s: init ret %r", self._name, ret)

	def __str__(self):
		return self._name

	def __repr__(self):
		return "<Accessor: {}>".format(self._name)

	def __getattribute__(self, attr):
		if attr != '_ports' and hasattr(self, '_ports'):
			for port in self._ports:
				if attr == port.python_name:
					return port._get()
		return object.__getattribute__(self, attr)

	def __setattr__(self, attr, value):
		if hasattr(self, '_ports'):
			for port in self._ports:
				if attr == port.python_name:
					port._set(value)
					return
		# All internal state must be prefixed with '_'
		if attr[0] != '_' and not hasattr(self, attr):
			raise AttributeError("%r object has no attribute %r" % (self, attr))
		return object.__setattr__(self, attr, value)

	def _init_runtime(self):
		### SUPPORT FUNCTIONS FOR THIS RUNTIME
		self._js.eval_block('''\
function _port_call (port, value) {
	log.debug("before port call of " + port + "(" + value + ")");
	global[port](value).next();
}
''')

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

		def runtime_time_sleep(time_in_ms):
			time.sleep(time_in_ms / 1000)
		self._js.export(runtime_time_sleep, '_time_sleep')

		self._js.eval_block('''\
time = Object();
time.sleep = _time_sleep;
time.run_later = function (delay_in_ms, fn_to_run, args) {
	log.warn("TODO: time.run_later is a synchronous wait in this runtime currently");
	_time_sleep(delay_in_ms);
	fn_to_run(args);
};
''')


		### ACCESSOR INTERFACE AND PROPERTIES

		def get(port_name):
			for port in self._ports:
				if port_name == port.accessor_name:
					r = port.get()
					log.debug("%s: get(%s) => %s", self._name, port_name, r)
					return r
			raise NotImplementedError("get unknown port: {}".format(port_name))
		self._js.export(get)

		def set(port_name, value):
			for port in self._ports:
				if port_name == port.accessor_name:
					log.debug("%s: set(%s) <= %s", self._name, port_name, value)
					port.set(value)
					return
			raise NotImplementedError("set unknown port: {}".format(port_name))
		self._js.export(set)

		def get_parameter(parameter_name):
			try:
				r = self._parameters[parameter_name]
			except:
				log.warn("get_parameter lookup failed for: >%s<", parameter_name)
				raise
			log.debug("get_parameter(%r) => %r", parameter_name, r)
			return r
		self._js.export(get_parameter)


		### SOCKETS

		def runtime_socket(family, sock_type):
			family = getattr(socket, family)
			sock_type = getattr(socket, sock_type)
			sock = socket.socket(family, sock_type)
			if not hasattr(self, '_socks'):
				self._socks = {}
			self._socks[sock.fileno()] = sock
			log.debug("runtime_socket(%r, %r) => %r", family, sock_type, sock.fileno())
			return sock.fileno()
		self._js.export(runtime_socket, '_socket')

		def runtime_socket_sendto(fd, msg, dest):
			log.debug("runtime_socket_sendto(%r, %r, %r)", fd, msg, dest)
			sock = self._socks[fd]
			dest = (dest[0], int(dest[1]))
			msg = msg.encode('utf-8')
			sock.sendto(msg, dest)
		self._js.export(runtime_socket_sendto, '_socket_sendto')

		self._js.eval_block('''\
socket = Object();
socket.socket = function* (family, sock_type) {
	var s = Object();

	s._fd = _socket(family, sock_type);

	s.sendto = function* (message, destination) {
		_socket_sendto(s._fd, message, destination);
	};

	return s;
}
''')


		### HTTP Requests

		def http_request(url, method, properties=None, body=None, timeout=None):
			raise NotImplementedError("http_request")
		self._js.export(http_request, '_http_request')

		def http_readURL(url):
			log.debug("%s: readUrl('%s')", self._name, url)
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

pprint.pprint(accessors)

try:
	rpidoor = accessors['University of Michigan - 4908 BBB']['rpidoor']
	log.debug("before lock")
	rpidoor.lock = False
	log.debug('after lock')
finally:
	sh.killall('node')

try:
	stocktick = accessors['Anywhere']['StockTick']
	for symbol in ['GOOG', 'MSFT', 'YHOO']:
		stocktick.stock_symbol = symbol
		print("Stock {} price {}".format(stocktick.stock_symbol, stocktick.price))
finally:
	# Hack until I undertsand bond better
	sh.killall('node')
