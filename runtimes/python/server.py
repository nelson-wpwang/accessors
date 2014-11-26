#!/usr/bin/env python3

import base64
import pprint
import time
import sys
import os
import argparse
import string
import urllib.parse

import markdown
import requests

import logging

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
	def create(port):
		# Default type is <string>
		if 'type' not in port:
			port['type'] = 'string'

		if port['direction'] == 'input':
			return InputPort(port)
		elif port['direction'] == 'output':
			return OutputPort(port)
		elif port['direction'] == 'inout':
			return InoutPort(port)
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

	def __init__(self, port):
		self.name = port['name']
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

	def get(self):
		return self.type(self.value)

class OutputPort(Port):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'output'

	def set(self, value):
		self.value = self.type(value)

class InoutPort(InputPort,OutputPort):
	def __init__(self, *args, **kwargs):
		super().__init__(*args, **kwargs)
		self.direction = 'inout'



class Accessor():
	def __init__(self, json):
		'''
		author
		parameters
		description
		version
		ports
		name
		code
		'''
		# Required Keys
		self.name = json['name']
		self.version = json['version']

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
			self.ports.append(Port.create(port))

		if 'code' not in json:
			raise NotImplementedError("Accessor without code?")
		self.code = json['code']

	def __str__(self):
		return self.name

accessors = {}
for location in get_locations():
	logging.debug('{} :: {}'.format(location['name'], location['path']))
	accessors[location['name']] = get_all_accessors_from_location(location['path'])

for location in accessors:
	print(location)
	for accessor in accessors[location]:
		print("\t{}".format(accessor))
		for port in accessor.ports:
			print("\t\t{}".format(port))
