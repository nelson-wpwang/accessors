#!/usr/bin/env python3

import logging
log = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

import argparse
import pprint
import copy
import xml.etree.ElementTree as ET
import json
import sys
import os
import re

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

# n.b. newer sh will support this directly when released
class pushd(object):
	def __init__(self, path):
		self.path = path

	def __enter__(self):
		self.cwd = os.getcwd()
		os.chdir(self.path)

	def __exit__(self, exception_type, exception_val, trace):
		os.chdir(self.cwd)


parse_js = sh.Command(os.path.abspath('./validate.js'))

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



###
### Classes for the webserver
###

# Base class for serving accessors.
class ServeAccessor (tornado.web.RequestHandler):
	def set_default_headers(self):
		self.set_header("Access-Control-Allow-Origin", "*")

	def get (self):
		print("get accessor {}".format(self))

		# Look for any parameters that change how we will respond
		language = self.get_argument('language', 'es6')

		# Handle any lazy alternate creation before creating a copy
		def create_traceur_alternate (accessor):
			accessor['code_alternates']['traceur'] =\
				javascript_to_traceur(accessor['code_alternates']['javascript'])
			for dep in accessor['dependencies']:
				create_traceur_alternate(dep)

		if language == 'traceur':
			if 'traceur' not in self.accessor['code_alternates']:
				create_traceur_alternate(self.accessor)

		# Create a local copy of the accessor to serve so we can configure it
		accessor = copy.deepcopy(self.accessor)

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
		author = ET.SubElement(top, 'author')
		for author_field,author_value in accessor['author'].items():
			ET.SubElement(author, author_field).text = author_value

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


###
### Functions that find and understand interfaces
###

interface_tree = {}

class Interface():
	def __init__(self, file_path, loop=[]):
		try:
			if file_path[-5:] != '.json':
				log.warn("Non-json file in interface tree: %s -- Skipped", file_path)
				log.warn("Do something better")
				return
			self.file_path = '.' + file_path

			self.path = file_path[:-5]
			log.debug("New Interface: %s", self.path)

			self.raw = open(self.file_path).read()
			self.json = json.loads(self.raw)

			self.ports = []
			if 'ports' in self.json:
				for port in self.json['ports']:
					print(port)
					self.ports.append(self.path[1:].replace('/', '.') + '.' + port)

			self.extends = []
			if 'extends' in self.json:
				if type(self.json['extends']) == type(''):
					self.json['extends'] = [self.json['extends'],]
				for dep in self.json['extends']:
					if dep not in interface_tree:
						log.debug("Interface %s requried advance loading of extends %s", self.path, dep)
						if dep in loop:
							log.critical("Recursive extends directives. %s", loop)
							raise RuntimeError
						else:
							loop.append(dep)
						Interface(dep+'.json', loop)
					self.extends.append(interface_tree[dep])

			interface_tree[self.path] = self
			print('---'*30)
			pprint.pprint(interface_tree)

		except:
			log.exception("Uncaught exception generating %s", self.path)
			raise

	def __iter__(self):
		for port in self.ports:
			yield port
		for ext in self.extends:
			for dep_port in ext:
				yield dep_port

	def get_port_detail(self, port, function_name):
		name = port.split('.')[-1]
		if port in self.ports:
			detail = self.json['ports'][name]
			detail['name'] = '/' + '/'.join(port.split('.'))
			detail['function'] = function_name
			return detail
		iface = '/' + '/'.join(port.split('.')[:-1])
		log.debug(iface)
		return interface_tree[iface].get_port_detail(port, function_name)

	@staticmethod
	def normalize(fq_port):
		log.debug("normalize: %s", fq_port)
		if '.' in fq_port:
			if '/' in fq_port:
				# /iface/path.Port
				iface, fq_port = fq_port.split('.')
			else:
				# All '.'
				iface = '/'+'/'.join(fq_port.split('.')[:-1])
				fq_port = fq_port.split('.')[-1]
		else:
			# All '/'
			iface, fq_port = fq_port.rsplit('/', 1)
		iface = interface_tree[iface]
		for port in iface:
			if port.split('.')[-1] == fq_port:
				return port
		log.error("Unknown port: %s", fq_port)
		log.error("Interface expects ports: %s", list(iface))
		raise NotImplementedError("Unknown port: {}".format(fq_port))

def load_interface_tree(root_path, prefix=None):
	with pushd(root_path):
		for root, dirs, files in os.walk('.'):
			root = root[1:] # strip leading '.'
			if root == '':  # imho python does this wrong; should be ./ already
				root = '/'

			for path in map(lambda x: os.path.join(root, x), files):
				Interface(path)

###
### Functions that find and generate full accessors
###

def javascript_to_traceur(javascript):
	sh.rm('-f', '_temp1.js')
	sh.rm('-f', '_temp2.js')
	try:
		open('_temp1.js', 'w').write(javascript)
		traceur('--out', '_temp2.js', '--script', '_temp1.js')
		try:
			code = open('_temp2.js').read()
		finally:
			sh.rm('-f', "_temp2.js")
	finally:
		sh.rm('-f', '_temp1.js')

	return code


def create_servable_objects_from_accessor (accessor, path):
	# Create the URL based on the hierarchy
	path = path[:-3]
	name = path.replace('/', '_')
	json_path = '/accessor{}.json'.format(path)
	xml_path = '/accessor{}.xml'.format(path)

	# Create a class for the tornado webserver to use when the accessor
	# is requested
	json_serve_class = type('ServeAccessor_' + name, (ServeAccessorJSON,), {
		'accessor': accessor
	})

	xml_serve_class = type('ServeAccessorXML_' + name, (ServeAccessorXML,), {
		'accessor': accessor
	})

	# Add the accessor to the list of valid accessors to request
	json_path = re.escape(json_path)
	xml_path = re.escape(xml_path)
	server_path_tuples.append((json_path, json_serve_class))
	server_path_tuples.append((xml_path, xml_serve_class))
	accessors_by_path[json_path] = json_serve_class
	print('Adding accessor {}'.format(json_path))
	print('Adding accessor {}'.format(xml_path))


accessor_tree = {}

def find_accessors (accessor_path, tree_node):

	def parse_error(msg, path, line_no=None, line=None):
		log.error(msg)
		if line_no and line:
			log.error("Found parsing %s on line %d: >>>%s<<<", path, line_no, line)
		elif line_no:
			log.error("Found parsing %s on line %d", path, line_no)
		else:
			log.error("Found parsing %s")
		sys.exit(1)

	with pushd(accessor_path):
		for root, dirs, files in os.walk('.'):
			root = root[1:] # strip leading '.'
			if root == '':  # imho python does this wrong; should be ./ already
				root = '/'

			for item_path in files:
				if item_path[:6] == 'README':
					log.debug("Ignoring %s", item_path)
					continue

				filename, ext = os.path.splitext(os.path.basename(item_path))
				if ext != '.js':
					log.warn("Non-.js in accessors: %s -- SKIPPED", item_path)
					continue

				path = os.path.join(root, item_path)

				log.debug("NEW ACCESSOR: %s", path)

				name = None
				author = None
				email = None
				website = None
				description = None

				# Parse the accessor source to pull out information in the
				# comments (name, author, email, website, description)
				line_no = 0
				in_comment = False
				with open("." + path) as f:
					while True:
						line = f.readline().strip()
						line_no += 1
						if len(line) is 0:
							continue

						if not in_comment:
							if line == '//':
								if description is not None:
									description += '\n'
								continue
							elif line[0:3] == '// ':
								line = line[3:]
							elif line[0:3] == '/* ':
								line = '* ' + line[3:]
								in_comment = True
							else:
								log.debug("non-comment line: >>%s<<", line)
								break
						else:
							if line == '*':
								if description is not None:
									description += '\n'
								continue
						if '*/' in line:
							if line[-2:] != '*/':
								parse_error("Comment terminator `*/` must end line",
										path, line_no, line)
							in_comment = False
							continue
						if in_comment:
							if line[0:2] != '* ':
								parse_error("Comment block lines must begin ' * '",
										path, line_no, line)
							line = line[2:]

						if line.strip()[:8] == 'author: ':
							author = line.strip()[8:].strip()
						elif line.strip()[:7] == 'email: ':
							email = line.strip()[7:].strip()
						elif line.strip()[:9] == 'website: ':
							website = line.strip()[9:].strip()
						elif line.strip()[:6] == 'name: ':
							name = line.strip()[6:].strip()
						elif author and email and description is None:
							if len(line.strip()) is 0:
								continue
							description = line + '\n'
						elif description is not None:
							description += line + '\n'
						else:
							# Comments above our stuff in the file
							pass

				if not author:
					parse_error("Missing required key: author", path)
				if not email:
					parse_error("Missing required key: email", path)

				meta = {
						'name': name if name else filename,
						'version': '0.1',
						'author': {
							'name': author,
							'email': email,
							},
						}
				# http://stackoverflow.com/q/3303312
				meta['safe_name'] = re.sub('\W|^(?=\d)', '_', meta['name'])
				if website:
					meta['author']['website'] = website
				if description:
					meta['description'] = description

				# External program that validates accessor and pulls out more
				# complex features from the source code, specifically:
				#	runtime_imports, implements, dependencies, parameters, ports
				try:
					analyzed = parse_js("." + path)
				except sh.ErrorReturnCode as e:
					log.debug('-'*50)
					print(e.stderr.decode("unicode_escape"))
					raise
				analyzed = json.loads(analyzed.stdout.decode('utf-8'))

				meta.update(analyzed)

				# Embed the actual code into the accessor
				meta['code'] = {
						'javascript': {
							'code' : open("."+path).read()
							}
						}

				# Now we make it a proper accessor
				accessor = meta

				# Verify interfaces are fully implemented
				for claim in accessor['implements']:
					claim['ports'] = []
					name_map = {}
					for port,name in claim['provides']:
						norm = Interface.normalize(port)
						claim['ports'].append(norm)
						name_map[norm] = name
					iface = interface_tree[claim['interface']]
					for req in iface:
						if req not in claim['ports']:
							log.error("Interface %s requires %s",
									claim['interface'], req)
							log.error("But %s only implements %s",
									accessor['name'], claim['ports'])
							raise NotImplementedError("Incomplete interface")
						accessor['ports'].append(iface.get_port_detail(req, name_map[req]))

				# Run the other accessor checker concept
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

				if 'code' in accessor:
					accessor['code_alternates'] = {}
					for language,v in accessor['code'].items():
						code = ''
						if 'include' in v:
							raise NotImplementedError("The 'include' option has been removed")
						if 'code' in v:
							code += v['code']
						accessor['code_alternates'][language] = code

						if language != 'javascript':
							raise NotImplementedError("Accessor code must be javascript")
					del accessor['code']

				assert path not in accessor_tree
				accessor_tree[path] = accessor

				create_servable_objects_from_accessor(accessor, path)

				if accessor['name'] == 'Hue Single':
					pprint.pprint(accessor)



DESC = """
Run an accessor hosting server.
"""


parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-p', '--accessor_path',
                    default='../accessors',
                    help='The root of the tree that holds the accessors.')
parser.add_argument('-i', '--interfaces_path',
                    default='../interfaces',
                    help='The root of the tree that holds the accessors.')
parser.add_argument('-t', '--tests', action='store_true',
                    help='Include test accessors')
args = parser.parse_args()

# Validate the accessor paths exist
args.accessor_path = os.path.abspath(args.accessor_path)
if not os.path.exists(args.accessor_path):
	raise IOError("Accessor Path ({}) does not exist".format(args.accessor_path))
args.interfaces_path = os.path.abspath(args.interfaces_path)
if not os.path.exists(args.interfaces_path):
	raise IOError("Interfaces Path ({}) does not exist".format(args.interfaces_path))

# Parse the interface heirarchy
load_interface_tree(args.interfaces_path)

# Initialize the accessors
find_accessors(args.accessor_path, None)

#pprint.pprint(accessor_tree, depth=2)

# # Start a monitor to watch for any changes to accessors
# class AccessorChangeHandler (watchdog.events.FileSystemEventHandler):
# 	def on_any_event (self, event):
# 		if str(event.src_path[-1]) == '~' or str(event.src_path[-4:-1]) == '.sw':
# 			# Ignore temporary files
# 			return
# 		print('\n\n' + '='*80)
# 		root = find_accessors(args.accessor_path, None)
# 		create_accessors(root)
# 
# observer = watchdog.observers.Observer()
# observer.schedule(AccessorChangeHandler(), path=args.accessor_path, recursive=True)
# observer.start()

# Start the webserver for accessors
accessor_server = tornado.web.Application(
	server_path_tuples,
	static_path="static/",
	debug=True
	)
accessor_server.listen(ACCESSOR_SERVER_PORT)

print('\nStarting accessor server on port {}'.format(ACCESSOR_SERVER_PORT))

# Run the loop!
tornado.ioloop.IOLoop.instance().start()
