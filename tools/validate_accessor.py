#!/usr/bin/env python3


import argparse
import json
import sys


DESC = '''Syntax checking on accessors'''

PORTS_RESERVED = ('init', 'fire', 'wrapup', 'get', 'set', 'get_parameter', 'get_dependency', 'rt')
ALPHANUMERIC = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

PARAMETERS_INVALID = '.'

schema = {
	'name': {
		'required': True,
		'type': str
	},
	'version': {
		'required': True,
		'type': str
	},
	'author': {
		'required': True,
		'type': dict,
		'required_keys': ['name', 'email'],
		'key_types': {'name':str, 'email':str, 'website':str}
	},
	'description': {
		'type': str
	},
	'ports': {
		'type': list,
		'subtype': dict,
		'required_keys': ['direction', 'name'],
		'unique_keys': ['name'],
		'key_types': {'direction':['input', 'output', 'inout'],
		              'name':str,
		              'type':['button', 'bool', 'string', 'numeric', 'integer', 'select', 'color', 'currency_usd'],
		              'options':(list, str),
		              'min':'number',
		              'max':'number'},
		'restrictions': {'name': {'invalid_str': PORTS_RESERVED,
		                          'valid_chr': ALPHANUMERIC}}
	},
	'parameters': {
		'type': list,
		'subtype': dict,
		'required_keys': ['name'],
		'unique_keys': ['name'],
		'key_types': {'name':str, 'default':str, 'required':bool},
		'restrictions': {'name': {'invalid_chr': PARAMETERS_INVALID}}
	},
	'code': {
		'type': dict,
		'subtype': dict,
		'key_types': {'code':str, 'include':(list, str)}
	},
	'dependencies': {
		'type': list,
		'subtype': dict,
		'required_keys': ['name', 'path'],
		'unique_keys': ['name'],
		'key_types': {'name':str, 'path':str, 'parameters':(dict, str)}
	}
}

def check(accessor):

	def aerr (error_type, error_msg):
		aerr.error_occurred = True
		print('ERROR! {} [{}]'.format(aerr.accessor_name, error_type))
		print('\tMessage:  {}'.format(error_msg))
	aerr.error_occurred = False
	aerr.accessor_name = accessor.get('name', '')

	# Check a dictionary for the correct keys, types, and uniqueness
	def check_dict (akey, item, params, find_unique=None):
		# Verify that required keys are present
		if 'required_keys' in params:
			for req_key in params['required_keys']:
				if req_key not in item:
					aerr(akey, 'Missing "{}" key'.format(req_key))

		# Populate uniqueness checking structures
		if 'unique_keys' in params and find_unique:
			for uniq_key in params['unique_keys']:
				find_unique[uniq_key][0].append(item[uniq_key])
				find_unique[uniq_key][1].add(item[uniq_key])

		# Check types
		if 'key_types' in params:
			for key,typ in params['key_types'].items():
				if key in item:
					if type(typ) == type:
						if type(item[key]) != typ:
							aerr(akey, 'Incorrect type for key "{}". Must be a {}.'.format(key, typ))
					elif type(typ) == list:
						if item[key] not in typ:
							aerr(akey, 'Incorrect type for key "{}". Must be in {}.'.format(key, typ))
					elif type(typ) == tuple:
						if type(item[key]) != typ[0]:
							aerr(akey, 'Incorrect type for key "{}". Must be a {}.'.format(key, typ))
						if type(item[key]) == list:
							for el in item[key]:
								if type(el) != typ[1]:
									aerr(akey, 'Incorrect type in list for "{}"'.format(key))
						elif type(item[key]) == dict:
							for k,v in item[key].items():
								if type(v) != typ[1]:
									aerr(akey, 'Incorrect type in dict for "{}"'.format(key))
					elif typ == 'number':
						try:
							float(item[key])
						except:
							aerr(akey, 'Incorrect type for key "{}". Must be numeric.'.format(key))

		if 'restrictions' in params:
			for key,restrictions in params['restrictions'].items():
				if key in item:
					if 'valid_str' in restrictions:
						if item[key] not in restrictions['valid_str']:
							aerr(akey, 'Key "{}" is not in the allowed set.'.format(key))
					if 'invalid_str' in restrictions:
						if item[key] in restrictions['invalid_str']:
							aerr(akey, 'Key "{}" is in the disallowed set.'.format(key))
					if 'valid_chr' in restrictions:
						for c in item[key]:
							if c not in restrictions['valid_chr']:
								aerr(akey, 'Key "{}" contains characters not in the valid set.'.format(key))
					if 'invalid_chr' in restrictions:
						for c in item[key]:
							if c in restrictions['invalid_chr']:
								aerr(akey, 'Key "{}" contains invalid characters.'.format(key))


		# if args.strict_parse:
		# 	for k,v in item.items():
		# 		if k not in key_types:
		# 			aerr(accessor, obj_key, 'Key "{}" not allowed.'.format(k))




	for key,params in schema.items():

		if params.get('required', False):
			if key not in accessor:
				aerr('', 'Missing required key "{}"'.format(key))

		if key in accessor:
			obj = accessor[key]

			if type(obj) != params['type']:
				aerr(key, 'accessor["{}"] must be a {}'.format(key, params['type']))

			if type(obj) == list:
				find_unique = {}
				if 'unique_keys' in params:
					for k in params['unique_keys']:
						find_unique[k] = ([], set())

				for item in obj:
					if type(item) != params['subtype']:
						aerr(key, 'Items must be {}'.format(params['subtype']))

					if type(item) == dict:
						check_dict(key, item, params, find_unique=find_unique)

				for uniq_key,setlist in find_unique.items():
					if len(setlist[0]) != len(setlist[1]):
						aerr(key, 'All "{}" keys must be unique'.format(uniq_key))

			elif type(obj) == dict:
				if 'subtype' not in params:
					check_dict(key, obj, params)

				elif params['subtype'] == dict:
					for k,v in obj.items():
						if type(v) != dict:
							aerr(key, 'Values must be of type dict.')
						check_dict(key, v, params)

	return aerr.error_occurred


if __name__ == '__main__':

	parser = argparse.ArgumentParser(description=DESC)
	parser.add_argument('accessor_file',
	                    nargs=1)

	args = parser.parse_args()


	with open(args.accessor_file[0]) as f:
		try:
			accessor = json.load(f, strict=False)
		except Exception as e:
			print('Could not parse accessor JSON')
			print(e)
			sys.exit(2)

		try:
			err = check(accessor)

			if err:
				print('Accessor is invalid')
				sys.exit(1)
			else:
				print('Accessor passes validation.')
		except Exception as e:
			print(e)
			sys.exit(1)


