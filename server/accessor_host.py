#!/usr/bin/env python3

import coloredlogs, logging
#coloredlogs.install()
coloredlogs.install(level=logging.DEBUG, show_hostname=False)
log = logging.getLogger(__name__)

import argparse
import bidict
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
import pyjsdoc

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



import mich_to_berk



base_path = os.path.dirname(os.path.realpath(__file__))
parse_js = sh.Command(os.path.join(base_path, 'validate.js'))

try:
	traceur = sh.Command(os.path.join(base_path, 'node_modules/traceur/traceur'))
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

ACCESSOR_REPO_URL = 'https://github.com/lab11/accessor-files.git'

accessor_db_cols = ('name',
                    'compilation_timestamp',
                    'group',
                    'path',
                    'jscontents',
                    'accessor',
                    'berkeleyJS',
                    'warnings',
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
		try:
			accessor_json = json.dumps(accessor, indent=4, sort_keys=True)
		except TypeError:
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

					if 'directions' in self.json['ports'][port]:
						raise NotImplementedError("Interface files should not specify directions, only attributes")

					if 'attributes' not in self.json['ports'][port]:
						log.warn("No attributes on interface %s ?", file_path)
						self.json['ports'][port]['attributes'] = ''

					directions = []
					if 'read' in self.json['ports'][port]['attributes']:
						directions.append('output');
					if 'write' in self.json['ports'][port]['attributes']:
						directions.append('input');
					if 'event'         in self.json['ports'][port]['attributes'] or \
					   'eventPeriodic' in self.json['ports'][port]['attributes'] or \
					   'eventChange'   in self.json['ports'][port]['attributes']:
						if 'output' not in directions:
							directions.append('output');
					self.json['ports'][port]['directions'] = directions

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

			# Check for conflicts in unqualified names from extensions
			self.unqualified = set()
			for port in self:
				port = port.split('.')[-1]
				if port in self.unqualified:
					log.error("Interface unqualified names conflict for port %s.", port)
					log.error("This isn't inherently unfixable, but tools don't")
					log.error("support it yet.")
					raise NotImplementedError("Ambiguous names in interface")
				self.unqualified.add(port)

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

	def get_port_detail(self, port, aliases=None):
		aliases = aliases or set()
		name = port.split('.')[-1]
		if port in self.ports:
			detail = copy.deepcopy(self.json['ports'][name])
			detail['name'] = '/' + '/'.join(port.split('.')[:-1])
			detail['name'] += '.' + name
			detail['aliases'] = list(aliases)
			detail['interface_path'] = self.path

			# We add some (currently) optional keys to make downstream stuff
			# easier, TODO: re-think about what should be required in the
			# definition of a complete accessor
			if 'type' not in detail:
				detail['type'] = 'string'
			if 'display_name' not in detail:
				detail['display_name'] = port.split('.')[-1]
			return detail
		aliases.add(port)
		iface = '/' + '/'.join(port.split('.')[:-1])
		log.debug(iface)
		return interface_tree[iface].get_port_detail(port, aliases)

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
				log.debug("normalize: %s -> %s", fq_port, port)
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
	class CompileError(Exception):
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

	log.info('Adding accessor {}'.format(view_path))

	try:
		name = None
		author = None
		email = None
		description = None

		warnings = collections.deque()
		errors = collections.deque()

		try:
			jsdoc = pyjsdoc.FileDoc(path, contents).to_dict()[0]
		except IndexError:
			parse_error("No valid jsdoc markup found", path)
		if 'author' in jsdoc:
			try:
				m = re.search('(?P<author>.+) (?P<email>\<.+@.+\>)', jsdoc['author']).groupdict()
				author = m['author']
				email = m['email'][1:-1]
			except (AttributeError, KeyError):
				parse_error("@author must include email", path)
		else:
			parse_error("Missing required jsdoc key @author", path)

		if 'display-name' in jsdoc:
			name = jsdoc['display-name']

		if 'module' not in jsdoc:
			parse_error("Must include @module in top jsdoc block", path)

		description = jsdoc['doc']
		# FIXME / HACK: pyjsdoc doesn't have native support for markdown. This
		# isn't a big deal, but it will prepend an extra space to each line
		# of the description blob, which causes problems down the line
		description = description.replace('\n ', '\n')

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
		pprint.pprint(analyzed)

		if 'parse_error' in analyzed:
			errors.appendleft({
				'loc': {
					'start': {
						'line': analyzed['parse_error']['lineNumber'],
						},
					'end': {
						'line': analyzed['parse_error']['lineNumber'],
						},
					'column': analyzed['parse_error']['column'],
					},
				'title': analyzed['parse_error']['description'],
				'extra': ["Failed to parse the JavaScript code. No further checks could be run"],
				})
			raise NotImplementedError

		for warning in analyzed['warnings']:
			warnings.append(warning)
		del analyzed['warnings']

		for error in analyzed['errors']:
			errors.append(error)
		del analyzed['errors']

		sends_to = analyzed['sends_to']
		del analyzed['sends_to']

		if len(errors):
			raise CompileError

		meta.update(analyzed)

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


		# Ports have a few different names, consider an accessor that implements
		# the `/lighting/light` interface, which includes a `Power` port that
		# the interface inherited from the `/onoff` interface:
		#
		#  * Canonical name:            /onoff.Power
		#  * Fully-qualified name (fq): /lighting/light.Power
		#  * Unqualified name:          Power
		#
		# For created ports, these three names will all be the same, but are
		# included in mappings as a convenience. The FQ name is determined by
		# the accessor's provideInterface call. The term "alias" refers to any
		# of the names for the same port
		#
		# port_aliases_to_fq: {'any alias' -> 'FQ name'}
		# port_fq_to_aliases: {'FQ name' -> ['canonical', 'FQ', 'unqualified']}
		accessor['port_aliases_to_fq'] = {}
		accessor['port_fq_to_aliases'] = {}

		accessor['ports'] = copy.deepcopy(accessor['created_ports'])
		for port in accessor['ports']:
			# This should have been covered by validate.js
			assert '.' not in port['name']
			assert '/' not in port['name']

			if 'type' not in port:
				port['type'] = 'string'
			if 'display_name' not in port:
				port['display_name'] = port['name']
			if 'aliases' not in port:
				port['aliases'] = []

			accessor['port_aliases_to_fq'][port['name']] = port['name']
			accessor['port_fq_to_aliases'][port['name']] = set([port['name'],])

		# For all provided interfaces, creates a map 'Beta' -> '/alpha.Beta'
		# Ambiguous entries, that is /alpha and /gamma both have Beta port, are
		# removed from the unqualified list and added to the conflicts list
		#
		# This uses only information gleaned from provideInterface calls
		unqualified_iface_ports = bidict.bidict()
		unqualified_iface_port_conflicts = []
		for claim in accessor['implements']:
			iface = interface_tree[claim['interface']]
			for port in iface:
				unqualified = port.split('.')[-1]
				if unqualified in unqualified_iface_ports:
					unqualified_iface_port_conflicts.append(unqualified)
				else:
					unqualified_iface_ports[unqualified] = port
		for unqualified in unqualified_iface_port_conflicts:
			del unqualified_iface_ports[unqualified]


		# Process the interface ports to validate their usage. These are ports
		# that used in port constructs (addInputHandler et al) that were not
		# created by createPort; that's less true actually, the sends_to hack
		# mixes in some stuff from createPort

		fixme_eventually = []
		for s in sends_to:
			fixme_eventually.append({
				'directions': ['output'],
				'name': s,
				})
		for port in accessor['interface_ports'] + fixme_eventually:
			if '.' not in port['name']:
				# Port is an unqualified name
				if port['name'] in unqualified_iface_ports:
					norm = unqualified_iface_ports[port['name']]
				else:
					if port['name'] in unqualified_iface_port_conflicts:
						errors.appendleft({
							'title': "Unqualified ambiguous port",
							'extra': [
								"The port named " + port['name'] + " belongs to multiple implemented interfaces",
								"It must be fully qualified",
							]})
						raise NotImplementedError
					else:
						for c in accessor['created_ports']:
							if c['name'] == port['name']:
								break
						else:
							warnings.appendleft({
								'title': 'Undeclared port implementation',
								'extra': [
									"The port named " + port['name'] + " does not belong to any implemented interface or created port.",
									"It is ignored."]
								})
						norm = port['name']
			else:
				# Port is a fully qualified name
				try:
					norm = Interface.normalize(port['name'])
				except KeyError:
					errors.appendleft({
						'title': "The port named " + port['name'] + " does not match any known interface",
						})
					raise NotImplementedError
			accessor['port_aliases_to_fq'][port['name']] = norm
			if norm not in accessor['port_fq_to_aliases']:
				accessor['port_fq_to_aliases'][norm] = set()
			accessor['port_fq_to_aliases'][norm].add(port['name'])

		for claim in accessor['implements']:
			iface = interface_tree[claim['interface']]
			for req in iface:
				if req not in accessor['port_fq_to_aliases']:
					errors.appendleft({
						'title': 'Incomplete interface implementation -- missing port',
						'extra': [
							"Interface %s requires %s" % (
								claim['interface'],
								req,
								),
							"But %s from %s only implements %s" % (
								accessor['name'],
								accessor['_path'],
								accessor['port_aliases_to_fq'],
								)
							]
						})
					complete_interface = False
				#for direction in iface[req]['directions']:
				#	if direction not in name_map[req]['directions']:
				#		warnings.appendleft({
				#			'title': 'Incomplete interface implementation -- missing port direction',
				#			'extra': [
				#				"Interface %s port %s requires %s" % (
				#					iface,
				#					req,
				#					iface[req]['directions'],
				#					),
				#				"But %s from %s only implements %s" % (
				#					accessor['name'],
				#					accessor['_path'],
				#					name_map[req]['directions'],
				#					)
				#				]
				#			})
				accessor['ports'].append(iface.get_port_detail(
					req,
					accessor['port_fq_to_aliases'][req]
					))

		for norm in accessor['port_fq_to_aliases']:
			accessor['port_fq_to_aliases'][norm] = list(accessor['port_fq_to_aliases'][norm])


		# Generate some convenience mappings for downstream as well:
		#
		# 'port_to_bundle' {port_str -> bundle_str}
		# 'bundle_to_ports' {bundle_str -> [port_str, port_str, ...] }

		accessor['port_to_bundle'] = {}
		accessor['bundle_to_ports'] = {}

		# Process port bundles
		for bundle in accessor['created_bundles']:
			# Bundles are gaurenteed to have at least one port by validate.js
			bundle_attrs = None
			bundle_dir = None

			accessor['bundle_to_ports'][bundle['name']] = []

			for port in bundle['contains']:
				for p in accessor['ports']:
					if port == p['name']:
						port = p
						break
					if port in p['aliases']:
						port = p
						break
				else:
					errors.appendleft({
						'loc': bundle['loc'],
						'title': 'Attempt to bundle a port that is not in this accessor',
						'extra': [
							bundle['name'] + ' includes the port "'+port+'", which is not a known port',
							'The known ports are ' + ', '.join(map(lambda x: x['name'], accessor['ports'])),
							],
						})
					complete_interface = False
					break

				if bundle_attrs is None:
					bundle_attrs = list(port['attributes'])
					bundle_dir = list(port['directions'])
				else:
					if bundle_attrs != port['attributes']:
						errors.appendleft({
							'loc': bundle['loc'],
							'title': 'All bundled ports (currently) must have the same attributes',
							'extra': [
								'"'+port['name']+'" has attributes '+str(port['attributes'])+', but previous ports had attributes '+str(bundle_attrs),
								],
							})
						complete_interface = False
						break

				if 'in_bundle' in port:
					errors.appendleft({
						'loc': bundle['loc'],
						'title': 'Attempt to bundle a port into multiple bundles',
						'extra': [
							'Tried to add the "'+port['name']+'" port to the bundle "'+bundle['name']+'", but it is already in the bundle "'+port['in_bundle']+'".',
							],
						})
					complete_interface = False
					break

				port['in_bundle'] = bundle['name']
				accessor['port_to_bundle'][port['name']] = bundle['name']
				accessor['bundle_to_ports'][bundle['name']].append(port['name'])
			else:
				bundle_port = {
						'name': bundle['name'],
						'display_name': bundle['name'],
						'attributes': bundle_attrs,
						'directions': bundle_dir,
						'type': 'bundle',
						'aliases': [],
						'bundles_ports': bundle['contains'],
						}

				accessor['ports'].append(bundle_port)
				accessor['port_aliases_to_fq'][bundle_port['name']] = bundle_port['name']
				if bundle_port['name'] not in accessor['port_fq_to_aliases']:
					accessor['port_fq_to_aliases'][bundle_port['name']] = []
				if bundle_port['name'] not in accessor['port_fq_to_aliases'][bundle_port['name']]:
					accessor['port_fq_to_aliases'][bundle_port['name']].append(bundle_port['name'])

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
					errors.appendleft({
						'title': 'Language Error: Accessor code must be javascript.',
						})
					raise NotImplementedError
			del accessor['code']

		if not complete_interface:
			# defer raising this so that all of the missing bits are reported
			raise NotImplementedError

		if len(accessor['ports']) == len(accessor['parameters']) == 0:
			warnings.appendleft({
				'title': 'Accessor has no ports and no parameters',
				})

		assert len(errors) == 0

		# Only try if no warnings, make too many assumptions o/w
		berkeley = None
		# if len(warnings) == 0:
		# 	try:
		# 		berkeley = mich_to_berk.convert(accessor)
		# 	except NotImplementedError:
		# 		pass
		# 	except Exception:
		# 		log.error("Uncaught exception from mich_to_berk")
		# 		raise Exception

		# Save accessor in in-memory DB
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=accessor,
							berkeleyJS=berkeley,
							warnings=warnings,
							)

		# Save a copy of the reverse mapping as well
		if db == accessors_db:
			for iface in accessor['implements']:
				interface = interface_tree[iface['interface']]
				interface.register_accessor(view_path)

		log.debug('Adding complete accessor {}'.format(view_path))
	except ParseError as e:
		for err in e.args:
			log.error(err)
		errors.appendleft({
			'title': e.args[0],
			'extra': [e.args[1],],
			})
		# meta object doesn't exist if this exception thrown
		# accessor object doesn't exist if this exception thrown
		db.insert(name=name if name else filename,
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							warnings=warnings,
							errors=errors)
		log.info('Parse error adding {}'.format(view_path))
	except sh.ErrorReturnCode as e:
		errors.appendleft({
			'title': 'Internal error. Please report this issue and include the full traceback below',
			'extra': [e.stderr.decode("unicode_escape"), ]
			})
		# accessor object doesn't exist if this exception thrown
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							warnings=warnings,
							errors=errors)
		log.info('Parse JS error adding {}'.format(view_path))
	except CompileError as e:
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
							warnings=warnings,
							errors=errors)
		log.info('Compile error adding {}'.format(view_path))
	except NotImplementedError as e:
		# accessor object exists in incomplete state if this
		# exception is thrown
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							warnings=warnings,
							errors=errors)
		log.info('Accessor implemetnation error found when adding {}'.format(view_path))
	except AssertionError as e:
		errors.appendleft({
			'title': 'Internal error.  Please report this issue and include all information below',
			})
		# accessor object doesn't exist if this exception thrown
		db.insert(name=meta['name'],
							compilation_timestamp=arrow.utcnow(),
							group=root,
							path=view_path,
							jscontents=contents,
							accessor=None,
							warnings=warnings,
							errors=errors)
		log.info('Assertion error adding {}'.format(view_path))
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
		try:
			self.write(json.dumps(accessor_list, sort_keys=True))
		except TypeError:
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
		def print_error_loc(contents, loc):
			html = ''
			lines = contents.split('\n')
			start = loc['start']['line']
			end   = loc['end']['line']
			# Go a few lines before and after for some context
			i = start - 3
			if i < 0:
				i = 0
			# Harder to go one line after though since could be multi-line and
			# less clear where the column indicator should go; skip for now

			# data-line=start-i b/c line highlighting and line offset don't know
			# about each other, then +1 b/c it's 1-indexed not 0-indexed
			html += '<pre class="line-numbers" data-start="{}" data-line="{}"><code class="language-javascript">'.format(i, start-i+1)
			while i <= end:
				# index at 'i-1' b/c line numbers are indexed starting at 1
				html += lines[i-1] + '\n'
				i += 1
			if 'column' in loc:
				# index at '-1' b/c column numbers are indexed starting at 1
				html += ' '*(loc['column']-1) + '^ Error here\n'
			# Remove last newline
			html = html[:-1]
			html += '</code></pre>'
			return html
		env.filters['print_error_loc'] = print_error_loc
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
accessors.create_accessor('$path_and_name', $parameters_arg, function (err, $instance) {
    if (err) {
        console.log('Error when creating $path_and_name accessor.');
        console.log(err);
        return;
    }

    $instance.init(function (err) {
        if (err) {
            console.log('Error when initing the accessor: ' + err);
            return;
        }

$ports    });
});''')

node_runtime_example_parameters = string.Template(
'''
var parameters = {
$parameters}
''')

node_runtime_example_parameters_entries = string.Template('''    $name: '',
''')

node_runtime_example_ports_input = string.Template(
'''        $instance.write('$port_name', value, function (err) {
            // Setting the port completed successfully.
        });

''')

node_runtime_example_ports_output = string.Template(
'''        $instance.read('$port_name', function (err, value) {
            console.log('Read $port_name and got: ' + value);
        });

''')

node_runtime_example_ports_observe = string.Template(
'''        $instance.on('$port_name', function (data) {
            console.log('Callback with ' + data);
        };

''')

def _node_runtime_example_bundle_port(tmpl, instance, port):
	val_tmpl = string.Template('''$name: value, ''');
	vals = ''
	for p in port['bundles_ports']:
		vals += val_tmpl.substitute(name=p)
	vals = vals[:-2] # remove last ', '
	return tmpl.substitute(
			instance=instance,
			port_name=port['name'],
			values=vals,
			)

def node_runtime_example_bundle_port(instance, port):
	s = ''
	if 'input' in port['directions']:
		tmpl = string.Template('''\
        $instance.write('$port_name', {$values}, function (err) {
            // Setting the port bundle completed successfully.
        });

''')
		s += _node_runtime_example_bundle_port(tmpl, instance, port)
	if 'output' in port['directions']:
		tmpl = string.Template('''\
        $instance.read('$port_name', function (err, value) {
			console.log("Read port bundle $port_name and got: ' + value);
			// value is an object that looks like {$values}
        });

''')
		s += _node_runtime_example_bundle_port(tmpl, instance, port)
	return s


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

def _python_runtime_example_bundle_port(tmpl, instance, port):
	val_tmpl = string.Template('''"$name": value, ''');
	vals = ''
	for p in port['bundles_ports']:
		vals += val_tmpl.substitute(name=p)
	vals = vals[:-2] # remove last ', '
	return tmpl.substitute(
			instance=instance,
			port_function=port['name'],
			values=vals,
			)

def python_runtime_example_bundle_port(instance, port):
	s = ''
	if 'input' in port['directions']:
		tmpl = string.Template('''\
print("Set multiple ports at once using $instance.$port_function:")
$instance.$port_function = {$values}
''')
		s += _python_runtime_example_bundle_port(tmpl, instance, port)
	if 'output' in port['directions']:
		tmpl = string.Template('''\
print("Read multiple ports by reading $instance.$port_function:")
values = $instance.$port_function
# values is dictionary: {$values}
''')
		s += _python_runtime_example_bundle_port(tmpl, instance, port)
	return s

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
			if 'bundles_ports' in port:
				node_ex_ports += node_runtime_example_bundle_port(record['accessor']['safe_name'], port)
				python_ex_ports += python_runtime_example_bundle_port(record['accessor']['safe_name'], port)
			else:
				if 'input' in port['directions']:
					node_ex_ports += node_runtime_example_ports_input.substitute(instance=record['accessor']['safe_name'],
																				 port_name=port['name'])
					python_ex_ports += python_runtime_example_ports_input.substitute(port_function=port['name'],
																					 instance=record['accessor']['safe_name'],
																					 port_name=port['name'])
				if 'output' in port['directions']:
					node_ex_ports += node_runtime_example_ports_output.substitute(instance=record['accessor']['safe_name'],
																				  port_name=port['name'])
					python_ex_ports += python_runtime_example_ports_output.substitute(port_function=port['name'],
																					  instance=record['accessor']['safe_name'],
																					  port_name=port['name'])
				if 'event' in port['attributes']:
					node_ex_ports += node_runtime_example_ports_observe.substitute(instance=record['accessor']['safe_name'],
																				   port_name=port['name'])
					python_ex_ports += python_runtime_example_ports_observe.substitute(port_function=port['name'],
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
'''/**
 * <accessor title>
 * ================
 *
 * <accessor description>
 *
 * @module
 * @author name <email>
 */

function setup () {
    provideInterface('$interface_name');
}

function* init() {$port_inits
    // Use the fully qualified interface port if disambiguation is necessary.
    // '$port_disambig_short' is an alias to '$port_disambig'
}
$port_functions''')

tmpl_accessor_interface_port_init = string.Template('''
    add${direction}Handler('$port', ${port}$direction);''')
tmpl_accessor_interface_port_impl = string.Template('''
var ${port}${direction} = function* ($argument) {
    // $help
$return_stmt}
''')

# Page that describes an interface
class handler_interface_page (JinjaBaseHandler):
	def get(self, path, **kwargs):
		path = '/'+path
		interface = interface_tree[path]

		port_init = ''
		port_impl = ''
		last_name = None

		def example_port (name, props):
			nonlocal port_init
			nonlocal port_impl
			nonlocal last_name
			last_name = name
			name = name.split('.')[-1]
			if 'read' in props['attributes']:
				port_init += tmpl_accessor_interface_port_init.substitute(
						direction='Read',
						port=name,
						)
				port_impl += tmpl_accessor_interface_port_impl.substitute(
						direction='Read',
						port=name,
						argument='',
						help='Implement here what happens when the ' + name + ' port is read.',
						return_stmt="""    send('"""+name+"""', val);
""",
						)
			if 'write' in props['attributes']:
				port_init += tmpl_accessor_interface_port_init.substitute(
						direction='Write',
						port=name,
						return_stmt=''
						)
				port_impl += tmpl_accessor_interface_port_impl.substitute(
						direction='Write',
						port=name,
						argument='val',
						help='Implement the logic for handing incoming data to the ' + name + ' port.',
						return_stmt='',
						)

		def recurse_interfaces (interface):
			for port_name,port_props in interface.ports.items():
				example_port(port_name, port_props)
			for extent in interface.extends:
				recurse_interfaces(extent)

		recurse_interfaces(interface)

		stub_code = tmpl_accessor_interface.substitute(
			interface_name=interface.path,
			port_inits=port_init,
			port_disambig_short=last_name.split('.')[-1],
			port_disambig=last_name,
			port_functions=port_impl,
			)

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
				if 'loc' in error:
					start = error['loc']['start']['line']
					end   = error['loc']['end']['line']
					if start != end:
						error += 'Lines {}-{}: '.format(start, end)
					else:
						error += 'Line {}'.format(start)
				if 'title' in error:
					error += err['title'] + '\n'
				else:
					error += "Internal error: Previously thrown error has no 'title'?"
				if 'extra' in err:
					for e in err['extra']:
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
### PtolemyII Support
################################################################################

class handler_ptolemy_index (tornado.web.RequestHandler):
	def get(self):
		index = []
		for record in accessors_db:
			if 'berkeleyJS' in record and record['berkeleyJS']:
				index.append(record['accessor']['_path'])

		try:
			self.write(json.dumps(index, sort_keys=True))
		except TypeError:
			self.write(json.dumps(index))

class handler_ptolemy_js (tornado.web.RequestHandler):
	def get(self, path):
		log.debug("get accessor >>{}<<".format(path))
		if path[0] != '/':
			path = '/' + path

		db  = accessors_db
		orig = first(db('path') == path)
		if not orig:
			log.debug("Accessor not found in db")
			self.send_error(404)
			return

		self.write(orig['berkeleyJS'])

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
parser.add_argument('--disable-periodic',
                    action='store_true',
                    help='Do not periodically pull new files.')
parser.add_argument('-u', '--repo-url',
                    default=ACCESSOR_REPO_URL,
                    help='Git URL of the repository to get accessors and interfaces from.')
parser.add_argument('-t', '--tests', action='store_true',
                    help='Include test accessors')
parser.add_argument('-p', '--port',
                    default=6565,
                    type=int,
                    help='Port the server should run on')
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
		# PtolemyII support
		(r'/ptolemy/index.json', handler_ptolemy_index),
		(r'/ptolemy/(.*).js', handler_ptolemy_js),
	],
	static_path="static/",
	template_path='jinja/',
	debug=True
	)
accessor_server.listen(args.port)

log.info('Starting accessor server on port {}'.format(args.port))

# Periodically fetch new files from github
if (not args.disable_git) and (not args.disable_periodic):
	def pull_git_periodic ():
		log.info('Pulling git repo')
		with pushd(accessor_files_path):
			git('pull')
		find_accessors(accessors_path)
	tornado.ioloop.PeriodicCallback(pull_git_periodic, 60000).start()

# Run the loop!
tornado.ioloop.IOLoop.instance().start()
