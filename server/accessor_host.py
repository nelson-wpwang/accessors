#!/usr/bin/env python3


import argparse
import copy
import json
import os

import tornado.ioloop
import tornado.web

import watchdog.events
import watchdog.observers

ACCESSOR_SERVER_PORT = 6565


server_path_tuples = []
accessors_by_path = {}


# Avoid this Cross-Origin nonsense
class ServerAccessorList (tornado.web.StaticFileHandler):
	def set_default_headers(self):
		self.set_header("Access-Control-Allow-Origin", "*")


# Base class for serving accessors.
class ServeAccessor (tornado.web.RequestHandler):
	def set_default_headers(self):
		self.set_header("Access-Control-Allow-Origin", "*")

	def get (self):
		self.set_header('Content-Type', 'application/json')

		# See if any of the parameters should be configured
		if 'parameters' in self.accessor:
			for p in self.accessor['parameters']:
				if 'required' in p and p['required']:
					p['value'] = self.get_argument(p['name'])
				else:
					p['value'] = self.get_argument(p['name'], p['default'])

		accessor_json = json.dumps(self.accessor, indent=4)
		#accessor_json = json.dumps(self.accessor, indent=4).replace('\\n', '\n')
		self.write(accessor_json)


def create_accessor (path, structure, ports, accessor):
	# Combine all of the ports from the interfaces and the accessor itself
	accessor['ports'] = ports + accessor['ports']

	# Handle any code include directives
	code = ''
	if 'include' in accessor['code']:
		for include in accessor['code']['include']:
			code += open(os.path.join(path, include)).read()
	if 'code' in accessor['code']:
		code += accessor['code']['code']
	accessor['code']['code'] = code

	# Create the URL based on the hierarchy
	name = ''.join(structure)
	path = '/accessor/{}'.format('/'.join(structure))

	# Create a class for the tornado webserver to use when the accessor
	# is requested
	serve_class = type('ServeAccessor' + name, (ServeAccessor,), {
		'accessor': accessor
	})

	if path in accessors_by_path:
		accessors_by_path[path].accessor = accessor
		print('Updating accessor {}'.format(path))

	else:

		# Add the accessor to the list of valid accessors to request
		server_path_tuples.append((path, serve_class))
		accessors_by_path[path] = serve_class
		print('Adding accessor {}'.format(path))



def find_accessors (path, structure, ports):

	sub_structure = copy.deepcopy(structure)
	sub_ports     = copy.deepcopy(ports)

	# Get the name of the folder we are currently in
	folder = os.path.basename(os.path.normpath(path))

	# See if there is a .json file in this folder with the same
	# name as the folder. If so, this is the interface file
	interface_path = os.path.join(path, folder) + '.json'
	if os.path.isfile(interface_path):
		with open(interface_path) as f:
			j = json.load(f, strict=False)
			sub_structure += [folder]
			if 'ports' in j:
				sub_ports += j['ports']


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
					j = json.load(f, strict=False)
					create_accessor(path, sub_structure+[filename], sub_ports, j)


	# Do the directories
	for item in contents:
		item_path = os.path.join(path, item)
		if os.path.isdir(item_path):
			find_accessors(item_path, sub_structure, sub_ports)




DESC = """
Run an accessor hosting server.
"""


parser = argparse.ArgumentParser(description=DESC)
parser.add_argument('-p', '--path',
                    required=True,
                    help='The root of the tree that holds the accessors.')
parser.add_argument('-l', '--location_path',
                    required=True,
                    help='The root of the location tree.')
args = parser.parse_args()


find_accessors(args.path, [], [])

# Start a monitor to watch for any changes to accessors
class AccessorChangeHandler (watchdog.events.FileSystemEventHandler):
	def on_any_event (self, event):
		print('GREAT')
		find_accessors(args.path, [], [])

observer = watchdog.observers.Observer()
observer.schedule(AccessorChangeHandler(), path=args.path, recursive=True)
observer.start()

# Start the webserver for accessors
accessor_server = tornado.web.Application(
	server_path_tuples +
	[(r'/accessors/(.*)', ServerAccessorList, {'path': args.location_path})])
accessor_server.listen(ACCESSOR_SERVER_PORT)

print('Starting accessor server on port {}'.format(ACCESSOR_SERVER_PORT))

# Run the loop!
tornado.ioloop.IOLoop.instance().start()


