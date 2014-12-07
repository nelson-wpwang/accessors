#!/usr/bin/env python3

import logging
log = logging.getLogger(__name__)

import base64
import pprint
import time
import sys
import os
import socket
import argparse
import string
import json
import colorsys

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
	print("Accessors require that `node` is installed.")
	print("Please get a copy from https://nodejs.org")
	sys.exit(1)

if node_version[0] == 'v':
	node_version = node_version[1:]
if not semver.match(node_version, ">=0.11.0"):
	print("Accessors require node version >=0.11.0")
	print("You have node version {} installed.".format(node_version))
	print("Please update your node installation")
	print("(You can use `nvm` to do this easily: github.com/creationix/nvm)")
	print("(then run `nvm use 0.11`)")
	sys.exit(1)


def format_accessor_server(url):
	if url[0:4] != 'http':
		url = "http://" + url
	if url[-1] == '/':
		url = url[:-1]
	return url


def get_known_locations():
	locations = []
	locations.append({'name': 'University of Michigan - 4908 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/4908'})
	locations.append({'name': 'University of Michigan - 2909 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/2909'})
	locations.append({'name': 'Anywhere',
	                  'path': '/'})

	return locations


def get_all_accessors_from_location (server, path):
	server = format_accessor_server(server)

	url = server + '/accessors'
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
		get_url = '{}/accessor{}'.format(server, accessor_url)
		logging.debug("GET {}".format(get_url))
		r2 = requests.get(get_url)
		if r2.status_code == 200:
			accessor = Accessor(accessor_url, r2.json())
			accessors[accessor._raw_name] = accessor
		else:
			raise NotImplementedError("Failed to get accessor: {}".format(get_url))

	return accessors

# I've clearly been writing too much JS since I think this is a good idea...
class Object():
	pass

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

		self.name = port['name']

		if port['type'] == 'select':
			self.type = Port.SelectType(port['options'])
		else:
			self.type = Port.TYPE_MAP[port['type']]

	def __str__(self):
		return '<{}> {}(<{}>)'.format(self.direction, self.name, str(self.type))


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
			log.debug("%s: call accesor fn: %s(%s)", self, self.name, value)
			r = self.accessor._js.call('_port_call', self.name, value)
			log.debug("%s: return %s", self, r)
			log.debug("%s: end accesor fn: %s(%s)", self, self.name, value)
		except bond.RemoteException as e:
			# This is maybe hack-y, maybe the best that can be done
			if e.data == 'TypeError: undefined is not a function':
				log.debug("%s: no port fn, default to fire", self)
				log.debug("%s: pre-fire", self)
				self.accessor._js.call('_port_call', 'fire')
				log.debug("%s: post-fire", self)
			else:
				raise

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
	def __init__(self, url, json, parent=None):
		self._url = url
		self._json = json
		self._parent = parent

		# This is a nice short handle, may have namespace issues though (TODO)
		self._raw_name = url.split('.json')[0].split('/')[-1]

		# Required Keys
		self._name = json['name']
		self._version = json['version']

		log.debug("Creating new accessor: %s", self._name)

		# Lazy-bind accessor init until first use
		self._js = None

		if 'author' in json:
			self._author = json['author']
		else:
			self._author = None

		if 'description' in json:
			self._description = json['description']
		else:
			self._description = None

		self._ports = {}
		for port in json['ports']:
			new_port = Port.create(port, self)
			self._ports[new_port.name] = new_port

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

		if 'dependencies' in json:
			self._sub_accessors = {}

	def _init(self):
		'''Call accessor init method'''
		if self._js is not None:
			raise RuntimeError("Multiple requests to init accessor")

		log.debug("%s: creating JS runtime", self._name)
		self._js = bond.make_bond('JavaScript', 'node', ['--harmony'])

		log.debug("%s: loading `harmony-reflect` (patches to support ES6 Proxy)", self)
		try:
			self._js.eval_block("var Reflect = require('harmony-reflect');")
		except bond.RemoteException as e:
			if e.data == "Error: Cannot find module 'harmony-reflect'":
				log.critical("Missing required node package harmony-reflect")
				log.critical("Install via `npm install harmony-reflect`")
				sys.exit(1)

		log.debug("%s: loading accessor", self._name)
		self._js.eval_block(self._code)

		self._init_runtime()

		log.debug("%s: running accessor init method", self._name)
		ret = self._js.call('_port_call', 'init')
		log.debug("%s: accessor init ret %r", self._name, ret)

	def __str__(self):
		if self._parent:
			return str(self._parent) + '.' + self._name
		return self._name

	def __repr__(self):
		return "<Accessor: {}>".format(self._name)

	def __getattribute__(self, attr):
		if attr != '_ports' and hasattr(self, '_ports') and attr in self._ports:
			return self._ports[attr]._get()
		return object.__getattribute__(self, attr)

	def __setattr__(self, attr, value):
		if hasattr(self, '_ports') and attr in self._ports:
			self._ports[attr]._set(value)
			return
		# All internal state must be prefixed with '_'
		if attr[0] != '_' and not hasattr(self, attr):
			raise AttributeError("%r object has no attribute %r" % (self, attr))
		return object.__setattr__(self, attr, value)

	def _init_runtime(self):
		self._runtime = Object()

		### SUPPORT FUNCTIONS FOR THIS RUNTIME
		self._js.eval_block('''\
function _port_call (port, value) {
	log.debug("before port call of " + port + "(" + value + ")");
	var r = global[port](value);
	if (r && typeof r.next == 'function') {
		r = r.next().value;
	}
	return r;
}
''')

		### GENERAL UTILITY

		def version(set_to):
			if set_to != "0.1.0":
				log.warn("Request for runtime version %s ignored", set_to)
			return "0.1.0"
		self._js.export(version)

		def subinit(sub_accessor, port_values):
			log.debug("%s: Creating sub accessor: %s", self, sub_accessor)
			dependency = None
			for dep in self._json['dependencies']:
				if dep['name'] == sub_accessor:
					dependency = dep
			if dependency is None:
				raise RuntimeError("Request for sub accessor not listed in depenecies")
			sub_accessor = Accessor(dependency['path'], dependency, parent=self)
			self._sub_accessors[sub_accessor._name] = sub_accessor

			log.debug("%s: Setting initial port values for %s", self, sub_accessor)
			if port_values is not None:
				for port,value in port_values.items():
					# Write port value directly, not through _set so fn doesn't run
					sub_accessor._ports[port].value = value

			log.debug("%s: Running init() in subaccessor %s", self, sub_accessor)
			sub_accessor._init()

			log.debug("Creating proxy %s <> %s", self, sub_accessor)
			self._js.export(
				sub_accessor._runtime.get,
				'_{}_handler_get'.format(sub_accessor._name)
				)
			self._js.export(
				sub_accessor._runtime.set,
				'_{}_handler_set'.format(sub_accessor._name)
				)
			self._js.export(
				sub_accessor._runtime.marshall,
				'_{}_handler_marshall'.format(sub_accessor._name)
				)
			self._js.eval_block('''
var _{name}_handler = {{
get: function (target, name) {{
	log.debug("target " + target + ", name " + name);
	if (name == 'get') {{
		return function (to_get) {{
			return _{name}_handler_get(to_get);
		}};
	}} else {{
		return function* (arg) {{
			log.debug("arg " + arg);
			log.debug("source: " + typeof arg);
			r = _{name}_handler_marshall(name, arg);
			log.debug("source: " + r);
			return r;
		}};
	}}
}},
set: function (target, prop, value) {{
	_{name}_handler_set(prop, value);
}}
}};
_{name}_proxy = new Proxy({{}}, _{name}_handler);
'''.format(name=sub_accessor._name))
			log.debug("%s: Created sub accessor: %s", self, sub_accessor)
			return '_{}_proxy'.format(sub_accessor._name);
		self._js.export(subinit, '_subinit')
		self._js.eval_block('''\
subinit = function* (sub_accessor, port_values) {
	var name = _subinit(sub_accessor, port_values);
	return global[name];
};
''')

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
			try:
				port = self._ports[port_name]
				r = port.get()
				log.debug("%s: get(%s) => %s", self._name, port_name, r)
				return r
			except:
				log.exception("Uncaught error in %s.get(%s)", self, port_name)
				raise
		self._runtime.get = get
		self._js.export(get)

		def set(port_name, value):
			try:
				port = self._ports[port_name]
				log.debug("%s: set(%s) <= %s", self._name, port_name, value)
				port.set(value)
				return
			except:
				log.exception("Uncaught error in %s.set(%s, %s)", self, port_name, value)
				raise
		self._runtime.set = set
		self._js.export(set)

		def marshall(fn, arg):
			log.debug("python %s, type %s", arg, type(arg))
			return self._js.call("_port_call", fn, arg);
		self._runtime.marshall = marshall

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
			log.debug("%s: http_request(%s, %s, prop=%s, body=%s, timeout=%s",
					self, url, method, properties, body, timeout)
			fn = getattr(requests, method.lower())
			if properties is not None:
				raise NotImplementedError("http_request properties")
			if body is not None:
				r = fn(url, data=body, timeout=timeout)
			else:
				r = fn(url, timeout=timeout)
			if r.status_code != 200:
				raise NotImplementedError("http_request: code != 200")
			log.debug("%s: http_request => %s", self, r.text)
			return r.text
		self._js.export(http_request, '_http_request')

		def http_readURL(url):
			log.debug("%s: readUrl('%s')", self, url)
			r = requests.get(url)
			if r.status_code != 200:
				raise NotImplementedError("readURL: request code != 200")
			return r.text
		self._js.export(http_readURL, '_http_readURL')

		self._js.eval_block('''\
http = Object();
http.request = function* (url, method, prop, body, timeout) {
	return _http_request (url, method, prop, body, timeout);
};
http.readURL = function* (url) { return _http_readURL(url); };
''')


		### Color
		def color_hex_to_hsv(hex_code):
			if hex_code[0] == '#':
				hex_code = hex_code[1:]
			r = int(hex_code[0:2], 16)
			g = int(hex_code[2:4], 16)
			b = int(hex_code[4:6], 16)
			r, g, b = map(lambda x: x/255, (r, g, b))
			return colorsys.rgb_to_hsv(r, g, b)
		self._js.export(color_hex_to_hsv, '_color_hex_to_hsv')

		def color_hsv_to_hex(hsv):
			rgb = colorsys.hsv_to_rgb(hsv['h'], hsv['s'], hsv['v'])
			r, g, b = map(lambda x: int(255*x), rgb)
			return "{:02x}{:02x}{:02x}".format(r, g, b)
		self._js.export(color_hsv_to_hex, '_color_hsv_to_hex')

		self._js.eval_block('''\
color = Object();
color.hex_to_hsv = _color_hex_to_hsv;
color.hsv_to_hex = _color_hsv_to_hex;
''')


def get_accessor_by_location(server, location, name):
	for loc in get_known_locations():
		if location == loc['name']:
			location = loc['path']
			break
	accessors = get_all_accessors_from_location(server, location)
	return accessors[name]

#accessors = {}
#for location in get_known_locations():
#	logging.debug('{} :: {}'.format(location['name'], location['path']))
#	accessors[location['name']] = get_all_accessors_from_location(location['path'])
#
#pprint.pprint(accessors)
