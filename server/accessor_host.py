#!/usr/bin/env python3

import logging
log = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

import argparse
import pprint
import copy
import xml.etree.ElementTree as ET
import json
import sys
import os
import re

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

accessors_db = pydblite.Base('accessors', save_to_file=False)
accessors_db.create(
		'name',
		'compilation_timestamp',
		'group',
		'path',
		'jscontents',
		'accessor',
		'errors',
		)

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

	def get (self, path):
		log.debug("get accessor {}".format(self))
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
		accessor = copy.deepcopy(first(accessors_db('path') == path)['accessor'])

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
						log.debug("Interface %s requried advance loading of extends %s", self.path, dep)
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

		except:
			log.exception("Uncaught exception generating %s", self.path)
			raise

	def __str__(self):
		return self.file_path

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


# accessor_tree = {}

def find_accessors (accessor_path):
	class ParseError(Exception):
		pass

	def parse_error(msg, path, line_no=None, line=None):
		if line_no and line:
			msg2 = "Found parsing %s on line %d: >>>%s<<<" % (path, line_no, line)
		elif line_no:
			msg2 = "Found parsing %s on line %d" % (path, line_no)
		else:
			msg2 = "Found parsing" + path
		raise ParseError(msg, msg2)

	with pushd(accessor_path):
		for root, dirs, files in os.walk('.'):
			root = root[1:] # strip leading '.'
			if root == '':  # imho python does this wrong; should be ./ already
				root = '/'

			for item_path in files:
				try:
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

						existing_accessor = first((accessors_db('path') == view_path) &
												  (accessors_db('jscontents') == contents))
						if existing_accessor:
							log.info('Already parsed {}, skipping'.format(path))
							continue

						old_accessor = first(accessors_db('path') == view_path)
						if old_accessor:
							log.info('Got new version of {}'.format(path))
							accessors_db.delete(old_accessor)
						else:
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
						log.error(e.stderr.decode("unicode_escape"))
						raise
					raw_analyzed = analyzed.stdout.decode('utf-8')
					analyzed = json.loads(raw_analyzed)

					meta.update(analyzed)

					# Embed the actual code into the accessor
					meta['code'] = {
							'javascript': {
								'code' : open("."+path).read()
								}
							}

					# Now we make it a proper accessor
					accessor = meta

					# Verify interfaces are fully implemented. We do this by
					# populating the ports key from a combination of created_ports
					# and interface_ports from the validator
					accessor['ports'] = copy.deepcopy(accessor['created_ports'])

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
									log.error("The port named " + port['name'] + " belongs to multiple implemented interfaces");
									log.error("It must be fully qualified")
									raise NotImplementedError("Unqualified ambiguous port")
								else:
									log.error("The port named " + port['name'] + " does not belong to any implemented interface")
									log.error("It is ignored.")
						else:
							# Port is a fully qualified name
							norm = Interface.normalize(port['name'])

						if norm in accessor['normalized_interface_ports']:
							raise NotImplementedError('Duplicate port conflict')
						accessor['normalized_interface_ports'].append(norm)
						name_map[norm] = port

					complete_interface = True
					for claim in accessor['implements']:
						iface = interface_tree[claim['interface']]
						for req in iface:
							if req not in accessor['normalized_interface_ports']:
								log.error("Interface %s requires %s",
										claim['interface'], req)
								log.error("But %s from %s only implements %s",
										accessor['name'], accessor['_path'], accessor['normalized_interface_ports'])
								complete_interface = False
							if iface[req]['directions'] != name_map[req]['directions']:
								log.error("Interface %s port %s requires %s",
										iface, req, iface[req]['directions'])
								log.error("But %s from %s only implements %s",
										accessor['name'], accessor['_path'], name_map[req]['directions'])
								complete_interface = False
							accessor['ports'].append(iface.get_port_detail(req, name_map[req]['name']))
					if not complete_interface:
						# defer raising this so that all of the missing bits are reported
						raise NotImplementedError("Incomplete interface")

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
							if 'include' in v:
								raise NotImplementedError("The 'include' option has been removed")
							if 'code' in v:
								code += v['code']
							accessor['code_alternates'][language] = code

							if language != 'javascript':
								raise NotImplementedError("Accessor code must be javascript")
						del accessor['code']

					# assert path not in accessor_tree
					# accessor_tree[path] = accessor

					# Save accessor in in-memory DB
					accessors_db.insert(name=meta['name'],
										compilation_timestamp=arrow.utcnow(),
										group=root,
										path=view_path,
										jscontents=contents,
										accessor=accessor)

					log.info('Adding accessor {}'.format(view_path))
				except ParseError as e:
					for err in e.args:
						log.error(err)
					# meta object doesn't exist if this exception thrown
					# accessor object doesn't exist if this exception thrown
					accessors_db.insert(name=name if name else filename,
										compilation_timestamp=arrow.utcnow(),
										group=root,
										path=view_path,
										jscontents=contents,
										accessor=None,
										errors=[e.args,])
				except Exception as e:
					log.error(e)
					log.info('Skipping accessor {} due to errors'.format(view_path))



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

        env = jinja2.Environment(loader=jinja2.FileSystemLoader(template_dirs))
        env.filters['markdown'] = jinja_filter_markdown

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

# Main index
class handler_index (JinjaBaseHandler):
	def get(self, **kwargs):
		data = {
			'accessors_db': accessors_db
		}
		return self.renderj('index.jinja2', **data)

# Page for each accessor
class handler_accessor_page (JinjaBaseHandler):
	def get(self, path, **kwargs):
		path = '/'+path

		records = accessors_db('path') == path

		data = {
			'record': first(records)
		}

		if not data['record']['accessor']:
			# Basic parsing didn't even work, show a dedicated error page
			# instead of the detail view page
			return self.renderj('view-parse-error.jinja2', **data)

		return self.renderj('view.jinja2', **data)



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
		(r'/view/(.*)', handler_accessor_page),
		# Accessor IR
		(r'/accessor/(.*).json', ServeAccessorJSON),
		(r'/accessor/(.*).xml', ServeAccessorXML),
		# Accessor lists
		(r'/list/all', ServeAccessorList),
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
