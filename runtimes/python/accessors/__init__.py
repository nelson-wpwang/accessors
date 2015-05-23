#!/usr/bin/env python3

import logging
log = logging.getLogger(__name__)

import base64
import pprint
import time
import sys
import traceback
import os
import copy
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

	for accessor in accessor_list['accessors']:
		accessor_path = accessor['path'] + '.json'
		get_url = '{}/accessor{}'.format(server, accessor_path)
		logging.debug("GET {}".format(get_url))
		r2 = requests.get(get_url)
		if r2.status_code == 200:
			if 'parameters' not in accessor:
				accessor['parameters'] = {}
			accessor = Accessor(accessor_path, r2.json(), accessor['parameters'])
			accessors[accessor._name] = accessor
		else:
			log.error("Failed to get accessor: {}".format(get_url))

	return accessors

# I've clearly been writing too much JS since I think this is a good idea...
class Object():
	pass

# Decorator to print tracebacks when crossing the runtime bridge
def exported(fn_to_decorate):
	def exported_fn_decorator(*args, **kwargs):
		try:
			return fn_to_decorate(*args, **kwargs)
		except:
			log.exception("Uncaught exception in exported function")
			raise
	return exported_fn_decorator

class Port():
	@staticmethod
	def create(port, accessor):
		if 'observe' in port['directions']:
			raise NotImplementedError("Python runtime doesn't support observe yet")
		if 'input' in port['directions']:
			if 'output' in port['directions']:
				return InoutPort(port, accessor)
			else:
				return InputPort(port, accessor)
		elif 'output' in port['directions']:
			return OutputPort(port, accessor)
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
			'currency_usd': float, #FIXME
			}

	def __init__(self, port, accessor):
		self.accessor = accessor

		self._name = port['name']
		self.name = port['function']

		if port['type'] == 'select':
			self.type = Port.SelectType(port['options'])
		else:
			self.type = Port.TYPE_MAP[port['type']]

	def __str__(self):
		return '<{}> {}(<{}>)'.format(self.direction, self.name, str(self.type))


class InputPort(Port):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'input'

	def _get(self):
		log.error("Attempt to get output only port %s", self)
		raise AttributeError

	def _set(self, value):
		if self.accessor._js is None:
			self.accessor._init()
		fn = self.name + '.input'
		log.debug("%s: call accesor fn: %s(%s)", self, fn, value)
		r = self.accessor._js.call('_port_call', fn, value)
		log.debug("%s: return %s", self, r)
		log.debug("%s: end accesor fn: %s(%s)", self, fn, value)

class OutputPort(Port):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'output'

	def _get(self):
		if self.accessor._js is None:
			self.accessor._init()
		fn = self.name + '.output'
		log.debug("%s: call accesor fn: %s(%s)", self, fn, None)
		r = self.accessor._js.call('_port_call', fn, None)
		log.debug("%s: return %s", self, r)
		log.debug("%s: end accesor fn: %s(%s)", self, fn, None)
		return r

	def _set(self):
		log.error("Attempt to set output only port %s", self)
		raise AttributeError


class InoutPort(InputPort,OutputPort):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'inout'


class Accessor():
	def __init__(self, url, json, parameters=None, parent=None):
		self._url = url
		self._json = json
		self._root_params = parameters
		self._parent = parent

		# Required Keys
		try:
			self._name = json['name']
			self._safe_name = json['safe_name']
			self._version = json['version']
		except:
			log.exception("Missing required key in accessor")
			pprint.pprint(json)
			raise

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
				if parameters and parameter['name'] in parameters:
					self._parameters[parameter['name']] = parameters[parameter['name']]
					continue

				if 'default' in parameter:
					self._parameters[parameter['name']] = parameter['default']
					continue

				if 'required' in parameter and parameter['required']:
					raise RuntimeError("{}: Missing value for required parameter {}".\
									format(self, parameter['name']))

		if 'code' not in json:
			raise NotImplementedError("Accessor without code?")
		self._code = json['code']

		if 'dependencies' in json:
			self._sub_accessors = {}

	def _init(self):
		'''Call accessor init method'''
		if self._js is not None:
			raise RuntimeError("Multiple requests to init accessor")

		log.debug("%s: creating JS runtime", self)
		self._js = bond.make_bond('JavaScript', 'node', ['--harmony'])

		log.debug("%s: loading `harmony-reflect` (patches to support ES6 Proxy)", self)
		try:
			self._js.eval_block("var Reflect = require('harmony-reflect');")
		except bond.RemoteException as e:
			if e.data == "Error: Cannot find module 'harmony-reflect'":
				log.critical("Missing required node package harmony-reflect")
				log.critical("Install via `npm install harmony-reflect`")
				sys.exit(1)

		# Need to set up empty objects to keep JS happy
		for port in self._json['created_ports']:
			self._js.eval_block('var ' + port['name'] + ' = {};')
		objs_made = set()
		for port in self._json['interface_ports']:
			to_make = port['name'].split('.')
			top = to_make.pop(0)
			if top not in objs_made:
				self._js.eval_block('var ' + top + ' = {};')
				objs_made.add(top)
			while to_make:
				temp = to_make.pop(0)
				top += '.' + temp
				if top not in objs_made:
					self._js.eval_block(top + ' = {};')
					objs_made.add(top)

		log.debug("%s: loading accessor", self)
		self._js.eval_block(self._code)

		self._init_runtime()

		log.debug("%s: running accessor init method", self)
		ret = self._js.call('_port_call', 'init')
		log.debug("%s: accessor init ret %r", self, ret)

	def __str__(self):
		if self._parent:
			return str(self._parent) + '.' + self._safe_name
		return self._safe_name

	def __repr__(self):
		return "<Accessor: {}>".format(self._safe_name)

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

		# Set up `rt` scope
		self._js.eval_block('rt = Object();')

		### SUPPORT FUNCTIONS FOR THIS RUNTIME
		self._js.eval_block('''\
/* For a variable number of parameters if needed, consider:
	var args = [];
	if (typeof value == 'object') {
		Object.keys(value).forEach(function(key) {
			args.push(value[key]);
		});
	} else {
		args = value;
	}
	rt.log.debug("before port call of " + port + "(" + args + ")");
	var r = global[port].apply(null, args);
*/

function _do_port_call (port, value) {
	var r;
	rt.log.debug("before port call of " + port + "(" + value + ")");
	if (port.indexOf('.') == -1) {
		r = global[port](value);
	} else {
		var temp = port.split('.');
		var obj = global[temp.shift()];
		while (temp.length) {
			obj = obj[temp.shift()];
		}
		r = obj(value);
	}
	rt.log.debug("after port call, r: " + r);
	if (r && typeof r.next == 'function') {
		r = r.next().value;
		rt.log.debug("after port call .next, r: " + r);
		return [r, true];
	}
	return [r, false];
}

function _port_call (port, value) {
	return _do_port_call(port, value)[0];
}

function _marshalled_port_call (port, value) {
	return _do_port_call(port, value);
}


function _dump_stack (dump_via) {
	var stack = new Error().stack;
	if (typeof dump_via == 'function') {
		dump_via(stack);
	} else {
		rt.log.debug(stack);
	}
}
''')

		### GENERAL UTILITY

		def version(set_to):
			if set_to != "0.1.0":
				log.warn("Request for runtime version %s ignored", set_to)
			return "0.1.0"
		self._js.export(version)

		self._js.eval_block('''\
create_port = function () {
	/* no-op: operation handled upstream */
}
''')

		self._js.eval_block('''\
provide_interface = function () {
	/* no-op: operation handled upstream */
}
''')

		def resolve_lazy_dependency(name):
			log.debug("%s: Request to resolve lazy binding for: %s", self, name)
			sub_accessor = self._sub_accessors[name]

			log.debug("%s: Running init() in subaccessor %s", self, sub_accessor)
			sub_accessor._init()

			self._js.export(
				sub_accessor._runtime.get,
				'_{}_handler_get'.format(sub_accessor._safe_name)
				)
			self._js.export(
				sub_accessor._runtime._set,
				'_{}_handler_set'.format(sub_accessor._safe_name)
				)
			self._js.export(
				sub_accessor._runtime.marshall,
				'_{}_handler_marshall'.format(sub_accessor._safe_name)
				)

			self._js.eval_block('_{}_is_inited = true;'.format(sub_accessor._safe_name))

			log.debug("%s: Completed lazy binding for: %s", self, sub_accessor)

		@exported
		def load_dependency(path, parameters):
			log.debug("%s: Creating sub accessor: %s", self, path)
			dependency = None
			for dep in self._json['dependencies']:
				if dep['path'] == path:
					dependency = dep
			if dependency is None:
				raise RuntimeError("Request for sub accessor not listed in depenecies")
			i = 0
			while True:
				if '{}_{}'.format(dependency['safe_name'], i) in self._sub_accessors:
					i += 1
				else:
					break
			dependency = copy.deepcopy(dependency)
			dependency['safe_name'] = '{}_{}'.format(dependency['safe_name'], i)
			sub_accessor = Accessor(path, dependency, parameters=parameters, parent=self)
			self._sub_accessors[sub_accessor._safe_name] = sub_accessor

			self._js.export(
					resolve_lazy_dependency,
					'_{}_resolve_lazy_dependency'.format(sub_accessor._safe_name)
					)

			log.debug("Creating proxy %s <> %s", self, sub_accessor)
			proxy_code = ('''\
_{name}_is_inited = false;
var _{name}_handler = {{
	get: function _{name}_proxy_get (target, name) {{
		rt.log.debug("_{name}_proxy_get target " + target + ", name " + name);
		if (!_{name}_is_inited) {{
			_{name}_resolve_lazy_dependency('{name}');
			if (!_{name}_is_inited) {{
				rt.log.critical("runtime error: failed to init subaccessor");
			}}
		}}
		if (name == 'get') {{
			return function _{name}_proxy_get_get (to_get) {{
				return _{name}_handler_get(to_get);
			}};
		}} else if (name == 'set') {{
			return function _{name}_proxy_get_set (prop, value) {{
				_{name}_handler_set(prop, value);
			}}
		}} else {{
			return function _{name}_proxy_get_fn (arg) {{
				var ret = _{name}_handler_marshall(name, arg);
				/* Can't marshall generator objects, instead we re-create one
				here if the other side was a generator */
				if (ret[1]) {{
					/*
					From stackoverflow.com/questions/16754956 I think this is
					more correct, but I don't know what [iterator] is doing and
					node (v0.11.13) doesn't like it, so a less-correct generator
					emulation it is (for now at least)

					var iterator = Symbol.iterator;
					return {{
						[iterator]: function() {{
							return this;
						}},
						next: function() {{
							{{
								value: ret[0]
								done: true
							}};
						}}
					}}
					*/
					var g = function () {{ return this; }};
					g.next = function() {{
						return {{
							value: ret[0],
							done: true
						}}
					}};
					return g;
				}}
				return ret[0];
			}};
		}}
	}}
}};
_{name}_proxy = new Proxy({{}}, _{name}_handler);
'''.format(name=sub_accessor._safe_name))
			self._js.eval_block(proxy_code)
			log.debug("%s: Created sub accessor: %s", self, sub_accessor)
			return '_{}_proxy'.format(sub_accessor._safe_name);

		self._js.export(load_dependency, '_load_dependency')
		self._js.eval_block('''\
load_dependency = function (path, parameters) {
	rt.log.debug("load_dependency (" + path + ", " + parameters + ")");
	var name = _load_dependency(path, parameters);
	return global[name];
};
''')

		def do_log(level, msg):
			f = getattr(log, level)
			f(msg)
			if level == 'criticl':
				raise NotImplementedError("runtime: log.critical")
		self._js.eval_block('''\
rt.log = Object();
rt.log.debug = function (msg) { _log('debug', msg); };
rt.log.info  = function (msg) { _log('info',  msg); };
rt.log.warn  = function (msg) { _log('warn',  msg); };
rt.log.error = function (msg) { _log('error', msg); };
rt.log.criticl = function (msg) { _log('critical', msg); };
''')
		self._js.export(do_log, "_log")

		def runtime_time_sleep(time_in_ms):
			time.sleep(time_in_ms / 1000)
		self._js.export(runtime_time_sleep, '_time_sleep')

		self._js.eval_block('''\
rt.time = Object();
rt.time.sleep = _time_sleep;
rt.time.run_later = function (delay_in_ms, fn_to_run, args) {
	rt.log.warn("TODO: time.run_later is a synchronous wait in this runtime currently");
	_time_sleep(delay_in_ms);
	fn_to_run(args);
};
''')


		### ACCESSOR INTERFACE AND PROPERTIES

		def get(port_name):
			try:
				port = self._ports[port_name]
				r = port.get()
				log.debug("%s: get(%s) => %s", self, port_name, r)
				return r
			except:
				log.exception("Uncaught error in %s.get(%s)", self, port_name)
				raise
		self._runtime.get = get
		self._js.export(get)

		def set(port_name, value):
			try:
				port = self._ports[port_name]
				log.debug("%s: set(%s) <= %s", self, port_name, value)
				port.set(value)
				return
			except:
				log.exception("Uncaught error in %s.set(%s, %s)", self, port_name, value)
				raise
		self._js.export(set)

		def _set(port_name, value):
			try:
				port = self._ports[port_name]
				port.value = value
				return
			except:
				log.exception("Uncaught error in marshalled %s.set(%s, %s)",
						self, arg['0'], arg['1'])
				raise
		self._runtime._set = _set

		def marshall(fn, arg):
			log.debug("python %s, type %s", fn, type(fn))
			log.debug("python %s, type %s", arg, type(arg))
			r = self._js.call("_marshalled_port_call", fn, arg);
			log.debug("python %s, type %s", r, type(r))
			return r
		self._runtime.marshall = marshall

		def get_parameter(parameter_name, default=None):
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
rt.socket = Object();
rt.socket.socket = function* (family, sock_type) {
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

		def http_get(url):
			log.debug("%s: get('%s')", self, url)
			r = requests.get(url)
			if r.status_code != 200:
				raise NotImplementedError("get: request code != 200")
			return r.text
		self._js.export(http_get, '_http_get')

		self._js.eval_block('''\
rt.http = Object();
rt.http.request = function* (url, method, prop, body, timeout) {
	return _http_request (url, method, prop, body, timeout);
};
rt.http.get = function* (url) { return _http_get(url); };
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
rt.color = Object();
rt.color.hex_to_hsv = _color_hex_to_hsv;
rt.color.hsv_to_hex = _color_hsv_to_hex;
''')


def get_accessor_by_location(server, location, name):
	for loc in get_known_locations():
		if location == loc['name']:
			location = loc['path']
			break
	accessors = get_all_accessors_from_location(server, location)
	try:
		return accessors[name]
	except:
		log.error("Count not find accesor by that name. Known accessors:")
		pprint.pprint(accessors)
		raise

def get_accessor_from_server(server, url, parameters={}):
	server = format_accessor_server(server)

	accessor_path = url + '.json'
	get_url = '{}/accessor{}'.format(server, accessor_path)
	logging.debug("GET {}".format(get_url))
	r2 = requests.get(get_url)
	if r2.status_code == 200:
		accessor = Accessor(accessor_path, r2.json(), parameters)
	else:
		log.error("Failed to get accessor: {}".format(get_url))
		raise NotImplementedError("get_accessor error case")

	return accessor

#accessors = {}
#for location in get_known_locations():
#	logging.debug('{} :: {}'.format(location['name'], location['path']))
#	accessors[location['name']] = get_all_accessors_from_location(location['path'])
#
#pprint.pprint(accessors)
