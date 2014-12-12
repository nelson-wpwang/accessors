#!/usr/bin/env python3


import argparse
import pprint
import copy
import xml.etree.ElementTree as ET
import json
import sys
import os

import semver

import tornado
import tornado.ioloop
import tornado.web
if not semver.match(tornado.version, ">=3.1.0"):
	raise ImportError("tornado version >=3.1 required")

import watchdog.events
import watchdog.observers

sys.path.append(os.path.abspath('../tools'))
import validate_accessor

import sh
from sh import rm
try:
	from sh import npm
except ImportError:
	print("You need to install npm: https://www.npmjs.org/")
	print("(this isn't a python package)")
	sys.exit(1)

traceur = os.path.join(
	os.getcwd(),
	'node_modules',
	'traceur',
	'traceur')
if not os.path.exists(traceur):
	print("Running npm...")
	npm('install', 'traceur')
traceur = sh.Command(traceur)

ACCESSOR_SERVER_PORT = 6565


server_path_tuples = []
accessors_by_path = {}

ET._original_serialize_xml = ET._serialize_xml
def _serialize_xml(write, elem, *args, **kwargs):
	if elem.tag == '![CDATA[':
		write("\n<%s%s]]>\n" % (elem.tag, elem.text))
		return
	return ET._original_serialize_xml(write, elem, *args, **kwargs)
ET._serialize_xml = ET._serialize['xml'] = _serialize_xml

def aerr (accessor, error_type, error_msg):
	print('ERROR! [{}]'.format(error_type))
	print('\tAccessor: {}'.format(accessor['name']))
	print('\tMessage:  {}'.format(error_message))
	sys.exit(1)

def anote (accessor, note_type, note):
	print('NOTICE! [{}]'.format(note_type))
	print('\tAccessor: {}'.format(accessor['name']))
	print('\tMessage:  {}'.format(note))

# These classes are used when building the tree of accessors based on their
# path. They are only used when the server is started or an accessor changes and
# not during the normal operation of the accessor host server. Their purpose
# is to aid in getting inherited ports setup correctly. 
class accessor_tree_node ():
	def __init__ (self, name, accessor):
		self.name = name
		self.accessor = accessor
		self.children = []

	def add_child (self, child):
		self.children.append(child)

	def __str__ (self):
		return self.to_string(0)

	def to_string (self, indent):
		s =  '{indent}ATN: {name}\n'.format(indent=' '*indent, name=self.name)
		s += '{indent}Children:\n'.format(indent=' '*indent)
		for c in self.children:
			s += c.to_string(indent+2)
		return s

class accessor_tree_leaf ():
	def __init__ (self, name, accessor, path):
		self.name = name
		self.accessor = accessor
		self.path = path

	def to_string (self, indent):
		s =  '{indent}ATL: {name}\n'.format(indent=' '*indent, name=self.name)
		return s

# These objects form the tree of accessor dependencies. Again they are used
# at initialization or when an accessor changes. Their purpose is to make sure
# that accessors include their dependencies correctly.
class accessor_dep_tree_node ():
	def __init__ (self, accessor):
		self.accessor = accessor
		self.children = []

	def add_child (self, child):
		self.children.append(child)

accessor_path_to_dep_tree = {}


# Avoid this Cross-Origin nonsense
class ServerAccessorList (tornado.web.StaticFileHandler):
	def set_default_headers(self):
		self.set_header("Access-Control-Allow-Origin", "*")

	def validate_absolute_path(self, root, absolute_path):
		if absolute_path[-3:] == 'xml':
			super().validate_absolute_path(root, absolute_path[:-3]+'json')
			return absolute_path
		return super().validate_absolute_path(root, absolute_path)

	def get_modified_time(self):
		if self.absolute_path[-3:] == 'xml':
			t = self.absolute_path
			self.absolute_path = self.absolute_path[:-3]+'json'
			ret = super().get_modified_time()
			self.absolute_path = t
			return ret
		return super().get_modified_time()

	def get_content_size(self):
		if self.absolute_path[-3:] == 'xml':
			return len(self.json_to_xml(self.absolute_path))
		return super().get_content_size()

	# http://tornado.readthedocs.org/en/latest/_modules/tornado/web.html#StaticFileHandler.get_content
	@classmethod
	def get_content(cls, abspath, start=None, end=None):
		name, ext = os.path.splitext(abspath)
		if ext == '.json':
			return super().get_content(abspath, start, end)

		if (start is not None) or (end is not None):
			raise NotImplementedError("Seek for Accessor List XML")

		return cls.json_to_xml(abspath)

	@classmethod
	def json_to_xml(cls, jsonpath):
		with open(jsonpath[:-3] + 'json') as f:
			j = json.loads(f.read())

			# some basic checks on the format
			assert 'accessors' in j
			assert len(j.keys()) == 1

			root = ET.Element('accessors')
			for accessor in j['accessors']:
				child = ET.Element("accessor", attrib={'path': accessor['path']})

				if 'parameters' in accessor:
					for name,value in accessor['parameters'].items():
						ET.SubElement(child, 'parameter', attrib={'name':name, 'value': value})

				root.append(child)

			return ET.tostring(root)


# Base class for serving accessors.
class ServeAccessor (tornado.web.RequestHandler):
	def set_default_headers(self):
		self.set_header("Access-Control-Allow-Origin", "*")

	def get (self):
		print("get accessor {}".format(self))
		# Create a local copy of the accessor to serve so we can configure it
		accessor = copy.deepcopy(self.accessor)

		# Look for any parameters that change how we will respond
		language = self.get_argument('language', 'es6')

		def set_dependency_js (accessor, language):
			for dep in accessor['dependencies']:
				dep['code'] = dep['code_alternates'][language]
				set_dependency_js(dep, language)

		if language == 'traceur':
			accessor['code'] = accessor['code_alternates']['traceur']
			set_dependency_js(accessor, 'traceur')
		elif language == 'es6' or language == 'javascript':
			accessor['code'] = accessor['code_alternates']['javascript']
			set_dependency_js(accessor, 'javascript')
		else:
			if language in accessor['code_alternates']:
				accessor['code'] = accessor['code_alternates'][language]
				set_dependency_js(accessor, language)
			else:
				raise NotImplementedError("Unknown language: {}".format(language))

		if 'code_alternates' in accessor:
			del accessor['code_alternates']
		def remove_dependency_code_alts (accessor):
			for dependency in accessor['dependencies']:
				if 'code_alternates' in dependency:
					del dependency['code_alternates']
				remove_dependency_code_alts(dependency)
		remove_dependency_code_alts(accessor)

		self.set_content_type()
		self.write_accessor(accessor)


# Wrapper class for serving JSON accessors.
class ServeAccessorJSON (ServeAccessor):
	def set_content_type (self):
		self.set_header('Content-Type', 'application/json')

	def write_accessor (self, accessor):
		accessor_json = json.dumps(accessor, indent=4)
		self.write(accessor_json)

# Wrapper class for serving XML accessors.
class ServeAccessorXML (ServeAccessor):
	def set_content_type (self):
			self.set_header('Content-Type', 'application/xml')

	def write_accessor (self, accessor):
		accessor_xml = self.convert_accessor_to_xml(accessor)
		self.write(accessor_xml)

	def convert_accessor_to_xml (self, accessor):
		# Start with common accessor stuff
		top = ET.Element('class', attrib={'name': accessor['name'],
		                                  'extends': 'org.terraswarm.kernel.JavaScript'})
		ET.SubElement(top, 'version').text = accessor['version']
		ET.SubElement(top, 'author').text = accessor['author']

		if 'description' in accessor:
			ET.SubElement(top, 'description').text = accessor['description']

		for port in accessor['ports']:
			# Direction is tag in xml
			props = {'name': port['name'], 'type': port['type']}

			if 'default' in port:
				props['value'] = str(port['default'])
			if 'options' in port:
				print("WARN: json -> xml: should probably make options elements");
				props['options'] = port['options']
			if 'min' in port:
				props['min'] = str(port['min'])
			if 'max' in port:
				props['max'] = str(port['max'])
			ET.SubElement(top, port['direction'], attrib=props)

		if 'parameters' in accessor:
			for parameter in accessor['parameters']:
				props = {'name': parameter['name']}
				if 'default' in parameter:
					props['default'] = str(parameter['default'])
				if 'value' in parameter:
					props['value'] = str(parameter['value'])
				if 'required' in parameter:
					props['required'] = str(parameter['required'])
				ET.SubElement(top, 'parameter', attrib=props)

		# For legacy, the 'code' key is named 'script'
		script = ET.SubElement(top, 'script', attrib={'type': 'text/javascript'})
		ET.SubElement(script, '![CDATA[', attrib={'type': 'text/javascript'})\
			.text = '\n{}\n'.format(accessor['code'])

		if 'dependencies' in accessor:
			print("WARN: json -> xml: dependencies")

		# This is legacy xml for v0 accessors, we don't use it
		doc = ET.SubElement(top, 'documentation', attrib={'type': 'text/html'})
		ET.SubElement(doc, '![CDATA[', attrib={'type': 'text/html'})\
			.text = accessor['description']

		s = '\n'.join(ET.tostringlist(top, encoding='unicode'))
		s = '''<?xml version="1.0" encoding="utf-8"?>
<?xml-stylesheet type="text/xsl" href="/static/v0/renderHTML.xsl"?>
<!DOCTYPE class PUBLIC "-//TerraSwarm//DTD Accessor 1//EN"
    "http://www.terraswarm.org/accessors/Accessor_1.dtd">
''' + s
		return s


def create_accessor (structure, accessor, path):
	err = validate_accessor.check(accessor)
	if err:
		print('ERROR: Invalid accessor format.')
		accessor['valid'] = False
		return

	# Make sure that we have at least empty fields for all of the various
	# keys in the accessor. This simplifies logic down the line.
	if 'ports' not in accessor:
		accessor['ports'] = []
	if 'parameters' not in accessor:
		accessor['parameters'] = []
	if 'code' not in accessor:
		accessor['code'] = {}
	if 'dependencies' not in accessor:
		accessor['dependencies'] = []

	# Handle any code include directives
	if 'code' in accessor:
		accessor['code_alternates'] = {}
		for language,v in accessor['code'].items():
			code = ''
			if 'include' in v:
				for include in v['include']:
					code += open(os.path.join(path, include)).read()
			if 'code' in v:
				code += v['code']
			accessor['code_alternates'][language] = code

			if language == 'javascript':
				sh.rm('-f', '_temp1.js')
				sh.rm('-f', '_temp2.js')
				try:
					open('_temp1.js', 'w').write(code)
					traceur('--out', '_temp2.js', '--script', '_temp1.js')
					try:
						accessor['code_alternates']['traceur'] = open('_temp2.js').read()
					finally:
						rm("_temp2.js")
				finally:
					rm('_temp1.js')
		del accessor['code']

	# Create the URL based on the hierarchy
	name = ''.join(structure)
	json_path = '/accessor/{}.json'.format('/'.join(structure[1:]))
	xml_path = '/accessor/{}.xml'.format('/'.join(structure[1:]))

	# Create a class for the tornado webserver to use when the accessor
	# is requested
	json_serve_class = type('ServeAccessor_' + name, (ServeAccessorJSON,), {
		'accessor': accessor
	})

	xml_serve_class = type('ServeAccessorXML_' + name, (ServeAccessorXML,), {
		'accessor': accessor
	})

	if json_path in accessors_by_path:
		accessors_by_path[json_path].accessor = accessor
		print('Updating accessor {}'.format(json_path))
		print('Updating accessor {}'.format(xml_path))

	else:
		# Add the accessor to the list of valid accessors to request
		server_path_tuples.append((json_path, json_serve_class))
		server_path_tuples.append((xml_path, xml_serve_class))
		accessors_by_path[json_path] = json_serve_class
		print('Adding accessor {}'.format(json_path))
		print('Adding accessor {}'.format(xml_path))



# Build accessors going down the tree
def create_accessors_recurse (accessor_tree, current_accessor, structure):
	structure.append(accessor_tree.name)

	# accessor_tree.accessor is the current accessor we are pointing to.
	#                        This is the furthest down the chain so far.
	# current_accessor       is the accessor we have been building so far

	if current_accessor == None:
		current_accessor = accessor_tree.accessor
	else:
		# Take what we want from current_accessor
		if 'ports' in current_accessor:
			if 'ports' in accessor_tree.accessor:
				accessor_tree.accessor['ports'] = \
					copy.deepcopy(current_accessor['ports']) + \
					accessor_tree.accessor['ports']
			else:
				accessor_tree.accessor['ports'] = \
					copy.deepcopy(current_accessor['ports'])

	if type(accessor_tree) == accessor_tree_leaf:
		# This is an accessor we can actually serve
		create_accessor(structure, accessor_tree.accessor, accessor_tree.path)

	else:
		# recurse!
		for atn in accessor_tree.children:
			create_accessors_recurse(atn, accessor_tree.accessor, copy.deepcopy(structure))

# Loads all dependencies and recurses in the case of nested dependencies
def create_accessors_dependencies_recurse (accessor, parameters, children):

	if 'dependencies' in accessor:
		for i,dep in enumerate(accessor['dependencies']):

			# Substitute in the given values of the parameters if they exist.
			if 'parameters' in dep:
				dep_accessor = children[i].accessor
				dep['parameters'].update(parameters)
				for parameter in dep_accessor['parameters']:
					if parameter['name'] in dep['parameters']:
						parameter['value'] = dep['parameters'][parameter['name']]
						del dep['parameters'][parameter['name']]

			# There may be some leftover parameters for further sub dependencies
			parameters_passdown = {}
			if 'parameters' in dep:
				for pname,pvalue in dep['parameters'].items():
					if '.' in pname:
						parameters_passdown['.'.join(pname.split('.')[1:])] = pvalue

			# Insert all of the fields of the accessor into the parent accessor
			# to form the full accessor with dependencies
			dep.update(children[i].accessor)

			# Recurse to fill in sub-accessors
			create_accessors_dependencies_recurse(dep,
			                                      parameters_passdown,
			                                      children[i].children)



	# for child in dep_tree_node.children:
	# 	create_accessors_dependencies_recurse(child)




	# if 'dependencies' in accessor:
	# 	for dependency in accessor['dependencies']:
	# 		path = '/accessor{}'.format(dependency['path'])
	# 		dep_accessor = copy.deepcopy(accessors_by_path[path])

	# 		# Load any preset parameters into the 

	# 		dependency['version'] = copy.deepcopy(accessors_by_path[path].accessor['version'])
	# 		dependency['code_alternates'] = copy.deepcopy(accessors_by_path[path].accessor['code_alternates'])
	# 		dependency['ports'] = copy.deepcopy(accessors_by_path[path].accessor['ports'])
	# 		dependency['parameters'] = copy.deepcopy(accessors_by_path[path].accessor['parameters'])


# Instantiate the dependency tree.
# The key here is to deep copy everything when making the tree. Rather than
# having a messy graph this gives us a nice directed acyclic graph that will
# make things work with preset parameters.
def create_dependency_tree_recurse (accessor_dep_tree_node):
	if 'dependencies' in accessor_dep_tree_node.accessor:
		for dep in accessor_dep_tree_node.accessor['dependencies']:
			if dep['path'] not in accessor_path_to_dep_tree:
				print('ERROR: dependency {} not found for accessor {}'\
					.format(dep['path'], accessor_dep_tree_node.accessor['name']))
				continue

			sub_node = copy.deepcopy(accessor_path_to_dep_tree[dep['path']])
			accessor_dep_tree_node.add_child(sub_node)

			create_dependency_tree_recurse(sub_node)

def create_accessors (accessor_tree):
	# This does the first pass on making complete accessors by resolving ports
	# and updating the code sections
	create_accessors_recurse(accessor_tree, None, [])

	# Next up: create the dependency tree
	for path,dep_tree_node in accessor_path_to_dep_tree.items():
		if not dep_tree_node.accessor.get('valid', True):
			continue
		create_dependency_tree_recurse(dep_tree_node)

	# After we have the tree, build complete accessors based on all of their
	# dependencies.
	for path,dep_tree_node in accessor_path_to_dep_tree.items():
		if not dep_tree_node.accessor.get('valid', True):
			continue
	#for path,accessor_obj in accessors_by_path.items():
		create_accessors_dependencies_recurse(dep_tree_node.accessor, {}, dep_tree_node.children)
		

def find_accessors (path, tree_node):

	# sub_structure = copy.deepcopy(structure)
	# sub_ports     = copy.deepcopy(ports)

	# Get the name of the folder we are currently in
	folder = os.path.basename(os.path.normpath(path))
	atn = None

	# See if there is a .json file in this folder with the same
	# name as the folder. If so, this is the interface file
	interface_path = os.path.join(path, folder) + '.json'
	if os.path.isfile(interface_path):
		with open(interface_path) as f:
			try:
				j = json.load(f, strict=False)
			except ValueError as e:
				print('ERROR: loading interface json: {}'.format(interface_path))
				print(e)
				sys.exit(1)
			atn = accessor_tree_node(folder, j)
			# sub_structure += [folder]
			# if 'ports' in j:
			# 	sub_ports += j['ports']
	else:
		atn = accessor_tree_node(folder, None)


	if tree_node:
		tree_node.add_child(atn)


	# Look for any other .json files. These are accessors
	contents = os.listdir(path)
	for item in contents:
		item_path = os.path.join(path, item)
		# Do only .json files on the first pass
		if os.path.isfile(item_path):
			filename, ext = os.path.splitext(os.path.basename(item_path))
			if ext == '.json' and filename != folder:
				# This must be an accessor file
				with open(item_path) as f:
					try:
						j = json.load(f, strict=False)
					except ValueError as e:
						print('ERROR: loading accessor json: {}'.format(item_path))
						print(e)
						continue
					atl = accessor_tree_leaf(filename, j, path)
					atn.add_child(atl)
					#create_accessor(path, sub_structure+[filename], sub_ports, j)

					# We make the node now with the current accessor. This pointer
					# will get updated later with the fully expanded ports.
					adtn = accessor_dep_tree_node(j)
					accessor_path = os.path.join(path, filename)
					# TODO: make this not a hack
					accessor_path = accessor_path[len(args.accessor_path)-1:]
					accessor_path_to_dep_tree[accessor_path] = adtn


	# Do the directories
	for item in contents:
		item_path = os.path.join(path, item)
		if os.path.isdir(item_path):
			find_accessors(item_path, atn)

	return atn




DESC = """
Run an accessor hosting server.
"""


parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-p', '--accessor_path',
                    required=True,
                    help='The root of the tree that holds the accessors.')
parser.add_argument('-l', '--location_path',
                    required=True,
                    help='The root of the location tree.')
args = parser.parse_args()

# Initialize the accessors
root = find_accessors(args.accessor_path, None)
create_accessors(root)

# Start a monitor to watch for any changes to accessors
class AccessorChangeHandler (watchdog.events.FileSystemEventHandler):
	def on_any_event (self, event):
		if str(event.src_path[-1]) == '~' or str(event.src_path[-4:-1]) == '.sw':
			# Ignore temporary files
			return
		root = find_accessors(args.accessor_path, None)
		create_accessors(root)

observer = watchdog.observers.Observer()
observer.schedule(AccessorChangeHandler(), path=args.accessor_path, recursive=True)
observer.start()

# Start the webserver for accessors
accessor_server = tornado.web.Application(
	server_path_tuples +
	[(r'/accessors/(.*)', ServerAccessorList, {'path': args.location_path})],
	static_path="static/",
	debug=True
	)
accessor_server.listen(ACCESSOR_SERVER_PORT)

print('\nStarting accessor server on port {}'.format(ACCESSOR_SERVER_PORT))

# Run the loop!
tornado.ioloop.IOLoop.instance().start()


