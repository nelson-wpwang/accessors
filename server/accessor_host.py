#!/usr/bin/env python3

import logging
log = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

import argparse
import pprint
import collections
import copy
import xml.etree.ElementTree as ET
import json
import string
import sys
import os
import re
import uuid
import tempfile

# All I want is the terminal title to change; oh well.
import setproctitle
setproctitle.setproctitle("accessors:host_server")
sys.stdout.write("\x1b]2;accessors:host_server\x07")

import jinja2
import markdown
import pydblite
import arrow
import semantic_version as semver

import tornado
import tornado.ioloop
import tornado.web
if semver.Version(tornado.version, partial=True) < semver.Version('3.1.0'):
	raise ImportError("tornado version >=3.1 required")

import watchdog.events
import watchdog.observers

#sys.path.append(os.path.abspath('../tools'))
#import validate_accessor

import sh
logging.getLogger("sh").setLevel(logging.WARNING)
from sh import rm
try:
	from sh import npm
except ImportError:
	log.error("You need to install npm: https://www.npmjs.org/")
	log.error("(this isn't a python package)")
	sys.exit(1)

try:
	from sh import git
except ImportError:
	log.error('You need to have git installed')
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


try:
	parse_js = sh.Command(os.path.abspath('./validate.js'))
except sh.CommandNotFound:
	parse_js = sh.Command(os.path.abspath('server/validate.js'))

try:
	traceur = sh.Command(os.path.abspath('./node_modules/traceur/traceur'))
except sh.CommandNotFound:
	try:
		traceur = sh.Command(os.path.abspath('server/node_modules/traceur/traceur'))
	except sh.CommandNotFound:
		log.error("You must run npm install traceur")
		sys.exit(1)

# traceur = os.path.join(
# 	os.getcwd(),
# 	'node_modules',
# 	'traceur',
# 	'traceur')
# if not os.path.exists(traceur):
# 	log.error("You must run npm install traceur")
# 	# npm('install', 'traceur')
# traceur = sh.Command(traceur)

ACCESSOR_SERVER_PORT = 6565
ACCESSOR_REPO_URL = 'https://github.com/lab11/accessor-files.git'

accessor_db_cols = ('name',
                    'compilation_timestamp',
                    'group',
                    'path',
                    'jscontents',
                    'accessor',
                    'errors')

accessors_db = pydblite.Base('accessors', save_to_file=False)
accessors_db.create(*accessor_db_cols)

accessors_dev_db = pydblite.Base('accessors-dev', save_to_file=False)
accessors_dev_db.create(*accessor_db_cols)

accessors_test_db = pydblite.Base('accessors-test', save_to_file=False)
accessors_test_db.create(*accessor_db_cols)



# Helper function to get the first result from a pydblite query
def first (iterable):
	for i in iterable:
		return i

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

	def get_accessors_db(self):
		return accessors_db

	def get (self, path):
		log.debug("get accessor >>{}<<".format(path))
		if path[0] != '/':
			path = '/' + path

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
		db  = self.get_accessors_db()
		orig = first(db('path') == path)
		if not orig:
			log.debug("Accessor not found in db")
			self.send_error(404)
			return
		accessor = copy.deepcopy(orig['accessor'])

		if accessor is None:
			raise NotImplementedError("Request for accessor with compilation errors")

		# def set_dependency_js (accessor, language):
		# 	for dep in accessor['dependencies']:
		# 		dep['code'] = dep['code_alternates'][language]
		# 		set_dependency_js(dep, language)

		if language == 'traceur':
			accessor['code'] = accessor['code_alternates']['traceur']
			# set_dependency_js(accessor, 'traceur')
		elif language == 'es6' or language == 'javascript':
			accessor['code'] = accessor['code_alternates']['javascript']
			# set_dependency_js(accessor, 'javascript')
		else:
			if language in accessor['code_alternates']:
				accessor['code'] = accessor['code_alternates'][language]
				# set_dependency_js(accessor, language)
			else:
				raise NotImplementedError("Unknown language: {}".format(language))

		if 'code_alternates' in accessor:
			del accessor['code_alternates']
		# def remove_dependency_code_alts (accessor):
		# 	for dependency in accessor['dependencies']:
		# 		if 'code_alternates' in dependency:
		# 			del dependency['code_alternates']
		# 		remove_dependency_code_alts(dependency)
		# remove_dependency_code_alts(accessor)

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
				log.warn("json -> xml: should probably make options elements");
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
			log.warn("json -> xml: dependencies")

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

			self.ports = {}
			if 'ports' in self.json:
				for port in self.json['ports']:
					#self.ports.append(self.path[1:].replace('/', '.') + '.' + port)
					self.ports[self.path[1:].replace('/', '.') + '.' + port] = self.json['ports'][port]

			self.extends = []
			if 'extends' in self.json:
				if type(self.json['extends']) == type(''):
					self.json['extends'] = [self.json['extends'],]
				for dep in self.json['extends']:
					if dep not in interface_tree:
						log.debug("Interface %s required advance loading of extends %s", self.path, dep)
						if dep in loop:
							log.critical("Recursive extends directives. %s", loop)
							raise RuntimeError
						else:
							loop.append(dep)
						Interface(dep+'.json', loop)
					self.extends.append(interface_tree[dep])

			interface_tree[self.path] = self
			log.debug('---'*30)
			log.debug(pprint.pformat(interface_tree))

			# All accessors that directly implement this interface (by accessor path)
			self.accessors = set()

			# All accessors that implement this interface because they implement
			# an interface that extends this one
			self.accessors_by_extends = set()

		except:
			log.exception("Uncaught exception generating %s", self.path)
			raise

	def __str__(self):
		return self.file_path[1:][:-5]

	def __iter__(self):
		for port in self.ports:
			yield port
		for ext in self.extends:
			for dep_port in ext:
				yield dep_port

	def __getitem__(self, key):
		if key in self.ports:
			return self.ports[key]
		for ext in self.extends:
			try:
				return ext[key]
			except KeyError:
				continue
		raise KeyError

	def get_port_detail(self, port, function_name):
		name = port.split('.')[-1]
		if port in self.ports:
			detail = copy.deepcopy(self.json['ports'][name])
			detail['name'] = '/' + '/'.join(port.split('.'))
			detail['function'] = function_name
			detail['interface_path'] = self.path
			# We add some (currently) optional keys to make downstream stuff
			# easier, TODO: re-think about what should be required in the
			# definition of a complete accessor
			if 'type' not in detail:
				detail['type'] = 'string'
			if 'display_name' not in detail:
				detail['display_name'] = port.split('.')[-1]
			return detail
		iface = '/' + '/'.join(port.split('.')[:-1])
		log.debug(iface)
		return interface_tree[iface].get_port_detail(port, function_name)

	def register_accessor(self, acc_path, from_ext=False):
		'''Record accessors that implement this interface and recurse into extends'''
		if from_ext:
			self.accessors_by_extends.add(acc_path)
		else:
			self.accessors.add(acc_path)
		for ext in self.extends:
			ext.register_accessor(acc_path, from_ext=True)

	def unregister_accessor(self, acc_path, from_ext=False):
		if from_ext:
			self.accessors_by_extends.discard(acc_path)
		else:
			self.accessors.discard(acc_path)
		for ext in self.extends:
			ext.unregister_accessor(acc_path, from_ext=True)

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
			if '/' not in fq_port:
				raise NotImplementedError("Request to normalize non-interface port: " + fq_port)
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


def process_accessor(
		db,           # Accessor DB to save to
		root,         # Just the bas '/webquery'
		filename,     # Just the name 'Bitcoin'
		path,         # The full path '/webquery/Bitcoin.js'
		contents,     # The file contents
		on_disk_path, # This really needs more refacotoring; wow
		):
	class ParseError(Exception):
		pass

	def parse_error(msg, path, line_no=None, line=None):
		if line_no and line:
			msg2 = "Found parsing %s on line %d: >>>%s<<<" % (path, line_no, line)
		elif line_no:
			msg2 = "Found parsing %s on line %d" % (path, line_no)
		else:
			msg2 = "Found parsing " + path
		raise ParseError(msg, msg2)

	# Strip .js from path
	view_path = path[0:-3]

	try:
		name = None
		author = None
		email = None
		website = None
		description = None

		# Parse the accessor source to pull out information in the
		# comments (name, author, email, website, description)
		line_no = 0
		in_comment = False
		for line in contents.split('\n'):
			line = line.strip()
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
					# log.debug("non-comment line: >>%s<<", line)
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
				'_path': path,
				'view_path': view_path,
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
			analyzed = parse_js(on_disk_path)
		except sh.ErrorReturnCode as e:
			log.debug('-'*50)
			log.error(e.stderr.decode("unicode_escape"))
			raise
		raw_analyzed = analyzed.stdout.decode('utf-8')
		analyzed = json.loads(raw_analyzed)

		meta.update(analyzed)
		errors = collections.deque()

		# Embed the actual code into the accessor
		meta['code'] = {
				'javascript': {
					'code' : contents
					}
				}

		# Now we make it a proper accessor
		accessor = meta

		# Verify interfaces are fully implemented. We do this by
		# populating the ports key from a combination of created_ports
		# and interface_ports from the validator

		# This flag defers throwing exceptions if possible to minimize churn and
		# maximize the number of errors we report per compilation
		complete_interface = True

		accessor['ports'] = copy.deepcopy(accessor['created_ports'])
		for port in accessor['ports']:
			if 'type' not in port:
				port['type'] = 'string'
			if 'display_name' not in port:
				port['display_name'] = port['name'].split('.')[-1]
			if len(port['directions']) == 0:
				errors.appendleft([
					"Created port {} implements no directions".format(port['name']),
					"All ports must define at least one of [input, output, observe]",
					"e.g., {}.output = function() {{ return 'current_value'; }}".format(port['name']),
					])
				complete_interface = False

		inferred_iface_ports = {}
		inferred_iface_ports_to_delete = []
		for claim in accessor['implements']:
			iface = interface_tree[claim['interface']]
			for port in iface:
				name = port.split('.')[-1]
				if name in inferred_iface_ports:
					inferred_iface_ports_to_delete.append(name)
				else:
					inferred_iface_ports[name] = port
		for name in inferred_iface_ports_to_delete:
			# Delete ambiguous entries
			del inferred_iface_ports[name]

		accessor['normalized_interface_ports'] = []
		name_map = {}
		for port in accessor['interface_ports']:
			if '.' not in port['name']:
				# Port is an unqualified name
				if port['name'] in inferred_iface_ports:
					norm = inferred_iface_ports[port['name']]
				else:
					if port['name'] in inferred_iface_ports_to_delete:
						errors.appendleft([
							"Unqualified ambiguous port",
							"The port named " + port['name'] + " belongs to multiple implemented interfaces",
							"It must be fully qualified"])
						raise NotImplementedError
					else:
						errors.appendleft([
							"The port named " + port['name'] + " does not belong to any implemented interface",
							"It is ignored."])
						norm = ''
			else:
				# Port is a fully qualified name
				try:
					norm = Interface.normalize(port['name'])
				except KeyError:
					errors.appendleft([
						"The port named " + port['name'] + " does not match any known interface",
						])
					raise NotImplementedError

			if norm in accessor['normalized_interface_ports']:
				errors.appendleft([
					'Duplicate port conflict',
					'Found trying to insert ' + port['name'],
					'But had previously inserted ' + norm])
				raise NotImplementedError
			accessor['normalized_interface_ports'].append(norm)
			name_map[norm] = port

		for claim in accessor['implements']:
			iface = interface_tree[claim['interface']]
			for req in iface:
				if req not in accessor['normalized_interface_ports']:
					errors.appendleft([
						"Interface %s requires %s" % (
							claim['interface'],
							req,
							),
						"But %s from %s only implements %s" % (
							accessor['name'],
							accessor['_path'],
							accessor['normalized_interface_ports'],
							)
						])
					complete_interface = False
				if iface[req]['directions'] != name_map[req]['directions']:
					errors.appendleft([
						"Interface %s port %s requires %s" % (
							iface,
							req,
							iface[req]['directions'],
							),
						"But %s from %s only implements %s" % (
							accessor['name'],
							accessor['_path'],
							name_map[req]['directions'],
							)
						])
					complete_interface = False
				accessor['ports'].append(iface.get_port_detail(req, name_map[req]['name']))
		if not complete_interface:
			# defer raising this so that all of the missing bits are reported
			raise NotImplementedError

		# Run the other accessor checker concept
		#err = validate_accessor.check(accessor)
		#TODO: Maybe put this back someday?
		#if err:
		#	log.error('ERROR: Invalid accessor format.')
		#	accessor['valid'] = False
		#	return

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
				if 'code' in v:
					code += v['code']
				accessor['code_alternates'][language] = code

				if language != 'javascript':
					errors.appendleft([
						'Language Error',
						'Accessor code must be javascript.',
						])
					raise NotImplementedError
			del accessor['code']

		# Save accessor in in-memory DB
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=accessor)

		# Save a copy of the reverse mapping as well
		for iface in accessor['implements']:
			interface = interface_tree[iface['interface']]
			interface.register_accessor(view_path)

		log.info('Adding accessor {}'.format(view_path))
	except ParseError as e:
		for err in e.args:
			log.error(err)
		# meta object doesn't exist if this exception thrown
		# accessor object doesn't exist if this exception thrown
		db.insert(name=name if name else filename,
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							errors=[e.args,])
		log.info('Parse error adding {}'.format(view_path))
	except sh.ErrorReturnCode as e:
		errors = [
				['Internal error.',
					'Please report this issue and include the full traceback below',
					],
				['Full traceback',
					e.stderr.decode("unicode_escape"),
					]
				]
		# accessor object doesn't exist if this exception thrown
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							errors=[e.args,])
		log.info('Parse JS error adding {}'.format(view_path))
	except NotImplementedError as e:
		# accessor object exists in incomplete state if this
		# exception is thrown
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							errors=errors)
		log.info('Accessor implemetnation error found when adding {}'.format(view_path))
	except Exception as e:
		log.error("Unhandled expection in accessor parsing")
		log.error(e)
		raise

def find_accessors (accessor_path):
	with pushd(accessor_path):
		for root, dirs, files in os.walk('.'):
			root = root[1:] # strip leading '.'
			if root == '':  # imho python does this wrong; should be ./ already
				root = '/'

			# Check if this is a test, and if so, store it in a different
			# database
			if len(root.split('/')) > 1 and root.split('/')[1] == 'tests':
				db = accessors_test_db
			else:
				db = accessors_db

			for item_path in files:
				if item_path[:6] == 'README':
					log.debug("Ignoring %s", item_path)
					continue

				filename, ext = os.path.splitext(os.path.basename(item_path))
				if ext != '.js':
					log.warn("Non-.js in accessors: %s -- SKIPPED", item_path)
					continue

				path = os.path.join(root, item_path)

				# Strip .js from path
				view_path = path[0:-3]

				# Check to see if we have already parsed this accessor
				contents = ''
				with open("." + path) as f:
					contents = f.read()

					existing_accessor = first((db('path') == view_path) &
											  (db('jscontents') == contents))
					if existing_accessor:
						log.info('Already parsed {}, skipping'.format(path))
						continue

					old_accessor = first(db('path') == view_path)
					if old_accessor:
						log.info('Got new version of {}'.format(path))
						for iface in old_accessor['accessor']['implements']:
							interface = interface_tree[iface['implements']]
							interface.unregister_accessor(old_accessor['path'])
						db.delete(old_accessor)
					else:
						log.debug("NEW ACCESSOR: %s", path)



				process_accessor(db, root, filename, path, contents, '.'+path)




################################################################################
### /list functions
################################################################################

class ServeAccessorList (tornado.web.RequestHandler):
	def set_default_headers(self):
		self.set_header("Access-Control-Allow-Origin", "*")

	def set_content_type (self):
		self.set_header('Content-Type', 'application/json')

	def get (self):

		accessor_list = []
		for accessor in accessors_db:
			accessor_list.append(accessor['path'])

		print(accessor_list)

		self.set_content_type()
		self.write(json.dumps(accessor_list))


################################################################################
### Jinja2 Support
###
### https://bibhas.in/blog/using-jinja2-as-the-template-engine-for-tornado-web-framework/
###
################################################################################

### Filters
def jinja_filter_markdown (string):
	return markdown.markdown(string)

# Helper classes for rendering jinja templates
class JinjaTemplateRendering:
	"""
	A simple class to hold methods for rendering templates.
	"""
	def render_template (self, template_name, **kwargs):
		template_dirs = []
		if self.settings.get('template_path', ''):
			template_dirs.append(
				self.settings["template_path"]
			)

		env = jinja2.Environment(
				loader=jinja2.FileSystemLoader(template_dirs),
				extensions=['jinja2.ext.i18n'],
				)
		env.filters['markdown'] = jinja_filter_markdown
		env.filters['interface'] = lambda iface:\
			'<a class="interface" href="/view/interface{iface}">{iface}</a>'.format(iface=iface)
		env.install_null_translations()

		try:
			template = env.get_template(template_name)
		except jinja2.TemplateNotFound:
			raise TemplateNotFound(template_name)
		content = template.render(kwargs)
		return content

class JinjaBaseHandler (tornado.web.RequestHandler, JinjaTemplateRendering):
	"""
	RequestHandler already has a `render()` method. I'm writing another
	method `renderj()` and keeping the API almost same.
	"""
	def renderj (self, template_name, **kwargs):
		"""
		This is for making some extra context variables available to
		the template
		"""
		kwargs.update({
			'settings': self.settings,
			'STATIC_URL': self.settings.get('static_url_prefix', '/static/'),
			'request': self.request,
			'xsrf_token': self.xsrf_token,
			'xsrf_form_html': self.xsrf_form_html,
		})
		content = self.render_template(template_name, **kwargs)
		self.write(content)





################################################################################
### Website GUI Frontend
################################################################################

###
### Templates for creating example node.js code with an accessor
###

node_runtime_example = string.Template(
'''#!/usr/bin/env node

var accessors = require('accessors.io');
$parameters
accessors.create_accessor('$path_and_name', $parameters_arg, function ($instance) {

$ports}, function (err) {
    console.log('Error when creating $path_and_name accessor.');
    console.log(err);
});''')

node_runtime_example_parameters = string.Template(
'''
var parameters = {
$parameters}
''')

node_runtime_example_parameters_entries = string.Template('''    $name: '',
''')

node_runtime_example_ports_input = string.Template(
'''    $instance.$port_function.input(value, function () {
        // Setting the port completed successfully.
    }, function (err) {
        console.log('Setting port $port_name failed.');
    });

''')

node_runtime_example_ports_output = string.Template(
'''    $instance.$port_function.output(function (value) {
        console.log('Read $port_name and got: ' + value);
    }, function (err) {
        console.log('Reading port $port_name failed.');
    });

''')

node_runtime_example_ports_observe = string.Template(
'''    $instance.$port_function.observe(function (data) {
        console.log('Callback with ' + data);
    }, function () {
        console.log('Observe port "$port_name" setup successfully');
    }, function (err) {
        console.log('Reading port $port_name failed.');
    });

''')


###
### Templates for creating example Python code with an accessor
###

python_runtime_example_with_parameters = string.Template(
'''#!/usr/bin/env python3

import accessors

$instance = accesors.get_accessor('$path_and_name', $parameters)

$ports''')

python_runtime_example_without_parameters = string.Template(
'''#!/usr/bin/env python3

import accessors

$instance = accesors.get_accessor('$path_and_name')

$ports''')

python_runtime_example_parameters = string.Template(
'''parameters = {
$parameters}''')

python_runtime_example_parameters_entries = string.Template('''\t$name: '',
''')

python_runtime_example_parameters_entries_with_default = string.Template(
'''\t# $name: '$default'  Parameter is optional, the default value will be used if one is not specified.
''')

python_runtime_example_ports_input = string.Template(
'''print("Set $instance.$port_function to {}".format(value))
$instance.$port_function = value
''')

python_runtime_example_ports_output = string.Template(
'''value = $instance.$port_function
print("$instance.$port_function = {}".format(value))
''')

python_runtime_example_ports_observe = string.Template(
'''$instance.$port_function.observe(lambda observation:
\t\tprint("Observation from $instance.$port_function: {}".format(observation))
\t\t)
''')

# Main index
class handler_index (JinjaBaseHandler):
	def get(self, **kwargs):
		data = {
			'accessors_db': sorted(accessors_db, key=lambda v: (v['group'], v['name'])),
			'accessors_test_db': sorted(accessors_test_db, key=lambda v: (v['group'], v['name'])),
			'interface_tree': interface_tree,
		}
		return self.renderj('index.jinja2', **data)


# Page for a summary of all the accessors in a group
class handler_group_page (JinjaBaseHandler):
	PREFIX = ''

	def get_accessors_db (self):
		return accessors_db

	def get(self, path, **kwargs):
		path = '/'+path

		db = self.get_accessors_db()
		records = db('group') == path
		record = first(records)

		data = {
				'records': records,
				'group': path,
				'prefix': self.PREFIX,
				}
		return self.renderj('group.jinja2', **data)

# Page for each accessor
class handler_accessor_page (JinjaBaseHandler):
	PREFIX=''
	flags = {}

	def generate_examples(self, record):
		node_ex_parameters = ''
		node_ex_parameters_arg = '{}'
		python_ex_parameters = ''
		if len(record['accessor']['parameters']) > 0:
			node_ex_params = ''
			node_ex_parameters_arg = 'parameters'
			python_ex_params = ''
			for param in record['accessor']['parameters']:
				node_ex_params += node_runtime_example_parameters_entries.substitute(name=param['name'])
				if param['required']:
					python_ex_params += python_runtime_example_parameters_entries.substitute(name=param['name'])
				else:
					python_ex_params += python_runtime_example_parameters_entries_with_default.substitute(name=param['name'],default=param['default'])
			node_ex_parameters = node_runtime_example_parameters.substitute(parameters=node_ex_params)
			python_ex_parameters = python_runtime_example_parameters.substitute(parameters=python_ex_params)

		node_ex_ports = ''
		python_ex_ports = ''
		for port in record['accessor']['ports']:
			if 'input' in port['directions']:
				node_ex_ports += node_runtime_example_ports_input.substitute(port_function=port['function'],
		                                                                     instance=record['accessor']['safe_name'],
				                                                             port_name=port['name'])
				python_ex_ports += python_runtime_example_ports_input.substitute(port_function=port['function'],
				                                                                 instance=record['accessor']['safe_name'],
				                                                                 port_name=port['name'])
			if 'output' in port['directions']:
				node_ex_ports += node_runtime_example_ports_output.substitute(port_function=port['function'],
		                                                                      instance=record['accessor']['safe_name'],
				                                                              port_name=port['name'])
				python_ex_ports += python_runtime_example_ports_output.substitute(port_function=port['function'],
				                                                                  instance=record['accessor']['safe_name'],
				                                                                  port_name=port['name'])
			if 'observe' in port['directions']:
				node_ex_ports += node_runtime_example_ports_observe.substitute(port_function=port['function'],
		                                                                      instance=record['accessor']['safe_name'],
				                                                              port_name=port['name'])
				python_ex_ports += python_runtime_example_ports_observe.substitute(port_function=port['function'],
				                                                                   instance=record['accessor']['safe_name'],
				                                                                   port_name=port['name'])

			python_ex_ports += '\n'

		node_ex = node_runtime_example.substitute(path_and_name=record['path'],
		                                          instance=record['accessor']['safe_name'],
		                                          parameters=node_ex_parameters,
		                                          parameters_arg=node_ex_parameters_arg,
		                                          ports=node_ex_ports)
		if len(record['accessor']['parameters']) > 0:
			python_ex = python_runtime_example_with_parameters.substitute(path_and_name=record['path'],
			                                                              instance=record['accessor']['safe_name'],
			                                                              parameters=python_ex_parameters,
			                                                              ports=python_ex_ports)
		else:
			python_ex = python_runtime_example_without_parameters.substitute(path_and_name=record['path'],
			                                                                 instance=record['accessor']['safe_name'],
			                                                                 ports=python_ex_ports)
		# Remove spurious blank lines at end
		while python_ex[-1] == '\n':
			python_ex = python_ex[:-1]

		return {
				'node': node_ex,
				'python': python_ex,
				}

	def get_accessors_db (self):
		return accessors_db

	def get (self, path, **kwargs):
		path = '/'+path

		db = self.get_accessors_db()
		records = db('path') == path
		record = first(records)

		# !! Must be checked first
		if not record:
			self.send_error(404)
			return
		elif not record['accessor']:
			data = {
				'record': record,
				'flags': self.flags,
				'prefix': self.PREFIX,
			}
			# Basic parsing didn't even work, show a dedicated error page
			# instead of the detail view page
			return self.renderj('view-parse-error.jinja2', **data)

		examples = self.generate_examples(record)

		data = {
			'record': record,
			'usage_examples': examples,
			'flags': self.flags,
			'prefix': self.PREFIX,
		}

		return self.renderj('view.jinja2', **data)


# Download link for examples
#
# This "subclass" is a bit of a hack to grab the example-gen'ing function.
# Should probably refactor at some point to generate examples only once and put
# the rendered example in the db or something
class handler_accessor_example (handler_accessor_page):
	def get(self, path, **kwargs):
		if path[0] != '/':
			path = '/'+path

		path,ext = path.split('.')

		db = self.get_accessors_db()
		records = db('path') == path
		record = first(records)

		if record is None:
			for a in db:
				log.debug('>>%s<<', a['path'])
			log.debug('>>%s<<', path)

		examples = self.generate_examples(record)

		if ext == 'js':
			self.set_header('Content-Type', 'text/javascript')
			ex = examples['node']
		elif ext == 'py':
			self.set_header('Content-Type', 'text/python')
			ex = examples['python']
		else:
			raise NotImplementedError("Request for unknown example file type: " + ext)

		self.set_header('Content-Length', len(ex))

		self.write(ex)
		self.flush()
		self.finish()


### Templates for example code for implementing a given interface
tmpl_accessor_interface = string.Template(
'''// name: 
// author: 
// email: 
//
// <accessor title>
// ================
//
// <accessor description>
//

function* init () {
    provide_interface('$interface_name');
}
$port_functions''')

tmpl_accessor_interface_port = string.Template(
'''
$port_name.$port_direction = function* ($port_argument) {
    $return_stmt
}
''')

# Page that describes an interface
class handler_interface_page (JinjaBaseHandler):
	def get(self, path, **kwargs):
		path = '/'+path
		interface = interface_tree[path]

		def example_port (name, props):
			out = ''
			for direction,arg,ret in [('input','val',''),
			                             ('output','','return val;'),
			                             ('observe','','send(\'/$port_name_sl\', val)')]:
				if direction in props['directions']:
					template_str = tmpl_accessor_interface_port
					for i in range(0,2):
						template_str = string.Template(template_str.substitute(
							port_name=name,
							port_direction=direction,
							port_argument=arg,
							return_stmt=ret,
							port_name_sl=name.split('.')[1]))
					out += template_str.substitute()
			return out

		def recurse_interfaces (interface, port_string):
			for port_name,port_props in interface.ports.items():
				port_string += example_port(port_name, port_props)
			for extent in interface.extends:
				port_string += recurse_interfaces(extent, port_string)
			return port_string

		port_strings = recurse_interfaces(interface, '')

		stub_code = tmpl_accessor_interface.substitute(
			interface_name=interface.path,
			port_functions=port_strings)

		data = {
				'interface': interface,
				'stub_code': stub_code
				}
		return self.renderj('interface.jinja2', **data)

################################################################################
### Tests
################################################################################

class handler_test_accessor_page (handler_accessor_page):
	PREFIX = '/test'
	flags = {'is_test': True}

	def get_accessors_db (self):
		return accessors_test_db

class handler_test_accessor_example (handler_accessor_example):
	def get_accessors_db (self):
		return accessors_test_db

	def get(self, path):
		return super().get('/' + path)

class handler_test_group_page (handler_group_page):
	PREFIX = '/test'
	flags = {'is_test': True}

	def get_accessors_db (self):
		return accessors_test_db

class ServeTestAccessorJSON (ServeAccessorJSON):
	def get_accessors_db(self):
		return accessors_test_db

	def get(self, path):
		return super().get('/' + path)

class ServeTestAccessorXML (ServeAccessorXML):
	def get_accessors_db(self):
		return accessors_test_db

	def get(self, path):
		return super().get('/' + path)

# I think we can avoid the duplication here by changing test and dev to be
# mixins, should look into that at some point

################################################################################
### Development support
################################################################################

dev_dir = tempfile.TemporaryDirectory()

class handler_dev (tornado.web.RequestHandler):
	def write_error(self, status_code, **kwargs):

		headers = kwargs.get('headers', {})
		for header_name,header_val in headers.items():
			print('adding {}:{}'.format(header_name, header_val))
			self.add_header(header_name, header_val)

		error = kwargs.get('error', '')
		self.write(error)

	def compile (self, name, contents):
		path = os.path.join(dev_dir.name, name) + '.js'
		open(path, 'w').write(contents)

		old_accessor = first(accessors_dev_db('path') == '/'+name)
		if old_accessor:
			accessors_dev_db.delete(old_accessor)

		process_accessor(
			accessors_dev_db,
			'/'+name,
			name,
			'/'+name+'.js',
			contents,
			path,
			)

		new_accessor = first(accessors_dev_db('path') == '/'+name)
		error = ''
		if not new_accessor['accessor']:
			error += "Failed to build.\n\n"

		if new_accessor['errors']:
			for err in new_accessor['errors']:
				error += err[0] + '\n'
				for e in err[1:]:
					error += '\t' + e + '\n'
			self.send_error(500, headers={'X-ACC-Name': name}, error=error)
			return

		self.add_header('X-ACC-Name', name)
		self.add_header('X-ACC-json', '/dev/accessor/' + name + '.json')
		self.add_header('X-ACC-xml', '/dev/accessor/' + name + '.xml')


class handler_dev_post (handler_dev):
	def post (self):
		name = str(uuid.uuid4())
		return self.compile(name, self.request.body.decode('utf-8'))

class handler_dev_put (handler_dev):
	def put (self, path):
		if path == '':
			self.send_error(500, reason="PUT requires a name in path")
			return
		return self.compile(path, self.request.body.decode('utf-8'))

class handler_dev_accessor_page (handler_accessor_page):
	flags = {'is_dev': True}

	def get_accessors_db (self):
		return accessors_dev_db

class ServeDevAccessorJSON (ServeAccessorJSON):
	def get_accessors_db(self):
		for a in accessors_dev_db:
			print('>>{}<<'.format(a['path']))
		return accessors_dev_db

	def get(self, path):
		return super().get('/' + path)

class ServeDevAccessorXML (ServeAccessorXML):
	def get_accessors_db(self):
		return accessors_dev_db

	def get(self, path):
		return super().get('/' + path)

################################################################################
### main()
################################################################################

DESC = """
Run an accessor hosting server.
"""

parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-n', '--disable-git',
                    action='store_true',
                    help='Do not pull new accessors from git repository.')
parser.add_argument('-u', '--repo-url',
                    default=ACCESSOR_REPO_URL,
                    help='Git URL of the repository to get accessors and interfaces from.')
parser.add_argument('-t', '--tests', action='store_true',
                    help='Include test accessors')
args = parser.parse_args()

# Make sure we have accessor files
here = os.path.dirname(os.path.abspath(__file__))
accessor_files_path = os.path.join(here, 'accessors')
if not args.disable_git:
	log.info('Updating accessor files from git repo')
	if not os.path.exists(accessor_files_path):
		log.debug('Need to clone the git repo')
		git('clone', args.repo_url, 'accessors')
	with pushd(accessor_files_path):
		log.debug('Pulling the accessor repository')
		git('pull')

# Parse the interface heirarchy
interfaces_path = os.path.join(accessor_files_path, 'interfaces')
load_interface_tree(interfaces_path)

# Initialize the accessors
accessors_path = os.path.join(accessor_files_path, 'accessors')
find_accessors(accessors_path)


# Start a monitor to watch for any changes to accessors
# class AccessorChangeHandler (watchdog.events.FileSystemEventHandler):
# 	def on_any_event (self, event):
# 		if str(event.src_path[-1]) == '~' or str(event.src_path[-4:-1]) == '.sw':
# 			# Ignore temporary files
# 			return
# 		print('\n\n' + '='*80)
# 		find_accessors(accessors_path)

# observer = watchdog.observers.Observer()
# observer.schedule(AccessorChangeHandler(), path=accessors_path, recursive=True)
# observer.start()


# Start the webserver for accessors
accessor_server = tornado.web.Application(
	[
		# User viewable web gui
		(r'/', handler_index),
		# Accessor lists
		(r'/list/all', ServeAccessorList),
		# Standard Accessors
		(r'/view/accessor/(.*)', handler_accessor_page),
		(r'/view/example/(.*)', handler_accessor_example),
		(r'/view/group/(.*)', handler_group_page),
		(r'/view/interface/(.*)', handler_interface_page),
		(r'/accessor/(.*).json', ServeAccessorJSON),
		(r'/accessor/(.*).xml', ServeAccessorXML),
		# Tests
		(r'/test/view/accessor/(.*)', handler_test_accessor_page),
		(r'/test/view/example/(.*)', handler_test_accessor_example),
		(r'/test/view/group/(.*)', handler_test_group_page),
		(r'/test/accessor/(.*).json', ServeTestAccessorJSON),
		(r'/test/accessor/(.*).xml', ServeTestAccessorXML),
		# Support to help develop accessors
		(r'/dev/view/accessor/(.*)', handler_dev_accessor_page),
		(r'/dev/accessor/(.*).json', ServeDevAccessorJSON),
		(r'/dev/accessor/(.*).xml', ServeDevAccessorXML),
		(r'/dev/upload', handler_dev_post),
		(r'/dev/upload/(.*)', handler_dev_put),
	],
	static_path="static/",
	template_path='jinja/',
	debug=True
	)
accessor_server.listen(ACCESSOR_SERVER_PORT)

log.info('Starting accessor server on port {}'.format(ACCESSOR_SERVER_PORT))

# Periodically fetch new files from github
if not args.disable_git:
	def pull_git_periodic ():
		log.info('Pulling git repo')
		with pushd(accessor_files_path):
			git('pull')
		find_accessors(accessors_path)
	tornado.ioloop.PeriodicCallback(pull_git_periodic, 60000).start()

# Run the loop!
tornado.ioloop.IOLoop.instance().start()
