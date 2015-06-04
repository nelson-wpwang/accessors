#!/usr/bin/python3

import sys

import string
import copy
import logging
log = logging.getLogger(__name__)

SUPPORTED_BLOCKING_FUNCTIONS = (
		'http.request',
		'http.get',
		'http.post',
		'http.put',
		)

def convert_type(type_str):
	if type_str == 'select':
		log.warning("Converting select to string, losing input enforcement")
		return 'string'
	elif type_str == 'numeric':
		return 'number'
	elif type_str == 'integer':
		return 'number'
	elif type_str == 'bool':
		return 'boolean'
	elif type_str == 'color':
		log.warning("Converting color to string")
		return 'string'
	return type_str

def get_berk_port_name(port):
	if 'display_name' in port:
		name = port['display_name']
	else:
		name = port['name']
	return name

def convert(accessor):
	# Create a local copy so we can mess with it
	accessor = copy.deepcopy(accessor)

	log.debug("Converting %s", accessor['name'])

	code = accessor['code_alternates']['javascript']

	# HACK Because I want to test HueSingle
	ports = []
	for port in accessor['ports']:
		if port['name'] != 'PCB':
			ports.append(port)
	accessor['ports'] = ports
	code = code.replace('PCB.', '_HACK_NO_PCB_')

	# Change port functions to be single literals
	#   lighting.Light.input -> _lighting_light_input
	for port in accessor['ports']:
		for direction in port['directions']:
			old_fn = port['function'] + '.' + direction
			new_fn = '_' + old_fn.replace('.', '_')
			log.debug('%s -> %s', old_fn, new_fn)
			code = code.replace(old_fn, new_fn)
		port['function'] = port['function'].replace('.', '_')

	# Patch input functions to call `get`
	for port in accessor['ports']:
		if 'input' in port['directions']:
			start = code.index(port['function'] + '_input')
			while code[start] != '(':
				start += 1
			start += 1
			end = start + 1
			while code[end] != ')':
				end += 1
			name = code[start:end]
			if ',' in name:
				log.error("Input function with multiple arguments?")
				raise NotImplementedError
			start = end + 1
			while code[start] != '{':
				start += 1
			start += 1
			new_code = "\n{} = get('{}');".format(name, get_berk_port_name(port))
			code = code[:start] + new_code + code[start:]

	# Add a get_parameter implementation
	code = code + '''\
get_parameter = function (param) {
	print("GETTING PARAMETER " + param);
	return get(param);
}

'''

	# Add a exports.setup
	setup_template = string.Template('''\
exports.setup = function() {
	print("SETUP");
	accessor.author('$author');
	accessor.version('0.1');
	accessor.description('$description');

$parameters
$inputs
$outputs
$observes
};

''')
	parameter_with_default_template = string.Template('''\
	accessor.input('$input', {
		'type': 'string',
		'default': '$value',
	});
''')
	parameter_without_default_template = string.Template('''\
	accessor.input('$input', {
		'type': 'string',
	});
''')
	input_template = string.Template('''\
	accessor.input('$input', {
		'type': '$type',
	});
''')
	output_template = string.Template('''\
	accessor.output('$output', {
		'type': '$type',
	});
''')
	observe_template = string.Template('''\
	accessor.output('$output', {
		'type': '$type',
	});
''')

	parameters = ''
	for param in accessor['parameters']:
		if param['required']:
			parameters += parameter_without_default_template.substitute(
					input=param['name'],
					)
		else:
			parameters += parameter_with_default_template.substitute(
					input=param['name'],
					default=param['default'],
					)

	inputs = ''
	outputs = ''
	observes = ''
	for port in accessor['ports']:
		t = convert_type(port['type'])
		if 'input' in port['directions']:
			inputs += input_template.substitute(
					type=t,
					input=get_berk_port_name(port),
					)
		if 'output' in port['directions']:
			if 'observe' in port['directions']:
				log.error("Don't handle output and observe yet");
				raise NotImplementedError
			outputs += output_template.substitute(
					type=t,
					output=get_berk_port_name(port),
					)
		if 'observe' in port['directions']:
			observes += observe_template.substitute(
					type=t,
					output=get_berk_port_name(port),
					)

	if 'description' not in accessor:
		accessor['description'] = 'No description provided'
	code = code + setup_template.substitute(
			author = '{} <{}>'.format(accessor['author']['name'], accessor['author']['email']),
			description = accessor['description'].split('\n')[0],
			parameters = parameters,
			inputs = inputs,
			outputs = outputs,
			observes = observes,
			)


	# Add a exports.fire
	fire_template = string.Template('''\
exports.fire = function() {
	print("FIRE CALLED");
$fires
};

''')

	# TODO: Open problem to map our `observe` construct
	fire_fn_template = string.Template('''\
	send(_${port_fn}_output(), '$port');
''')

	fires = ''
	for port in accessor['ports']:
		if 'output' in port['directions']:
			fires += fire_fn_template.substitute(
					port_fn = port['function'],
					port = port['name'],
					)

	code = code + fire_template.substitute(
			fires=fires,
			)



	# Add a exports.initialize, exports.wrapup
	initialize_template = string.Template('''\
exports.initialize = function() {
	print("INITIALIZE CALLED");
$handles
	if (typeof(init) !== undefined) {
		init();
	}
};

'''
)
	wrapup_template = string.Template('''\
exports.wrapup = function() {
	print("WRAPUP CALLED");
$handles
/* Name conflict; leads to recurision. Nothing we have uses this fn anyway 
 *
	if (typeof(wrapup) !== undefined) {
		wrapup();
	}
 */
};

'''
)
	handle_template = string.Template('''\
	$handle_fn($port_fn, '$port_name');
''')

	add_handles = ''
	remove_handles = ''
	for port in accessor['ports']:
		name = get_berk_port_name(port)
		if 'input' in port['directions']:
			add_handles += handle_template.substitute(
				handle_fn = 'addInputHandler',
				port_fn = '_' + port['function'] + '_input',
				port_name = name,
				)
			remove_handles += handle_template.substitute(
				handle_fn = 'removeInputHandler',
				port_fn = '_' + port['function'] + '_input',
				port_name = name,
				)
#		if 'output' in port['directions']:
#			add_handles += handle_template.substitute(
#				handle_fn = 'addOutputHandler',
#				port_fn = '_' + port['function'] + '_output',
#				port_name = name,
#				)
#			remove_handles += handle_template.substitute(
#				handle_fn = 'removeOutputHandler',
#				port_fn = '_' + port['function'] + '_output',
#				port_name = name,
#				)
#		if 'observe' in port['directions']:
#			add_handles += handle_template.substitute(
#				handle_fn = 'addOutputHandler',
#				port_fn = '_' + port['function'] + '_observe',
#				port_name = name,
#				)
#			remove_handles += handle_template.substitute(
#				handle_fn = 'removeOutputHandler',
#				port_fn = '_' + port['function'] + '_observe',
#				port_name = name,
#				)
	code = code + initialize_template.substitute(handles=add_handles)
	code = code + wrapup_template.substitute(handles=remove_handles)

	# Remove calls to createPort, provideInterface
	for remove in ('createPort', 'provideInterface'):
		while True:
			try:
				start = code.index(remove)
			except ValueError:
				break
			end = start + len(remove)
			while code[end] == ' ':
				end += 1
			if code[end] != '(':
				log.error("Expected ' ' or '(' after %s", remove)
				raise NotImplementedError
			end += 1
			count = 1
			while count > 0:
				if code[end] == '(':
					count += 1
				elif code[end] == ')':
					count -= 1
				end += 1
			if code[end] == ';':
				end += 1
			if code[end] == '\r':
				end += 1
			if code[end] == '\n':
				end += 1
			code = code[:start] + code[end:]


	# Remove function*, yield*
	code = code.replace('function*', 'function')
	all_converted = True
	while True:
		try:
			y = code.index('yield')
		except ValueError:
			break

		if code[y + len('yield')] != '*':
			log.error("yield instead of yield*? This is probably an accessor bug...")
			raise NotImplementedError

		before = y
		while code[before] not in ('\n', ';'):
			before -= 1
		before += 1
		before_text = code[before:y]

		fn_start = y + len('yield') + 1
		fn_end = fn_start + 1
		while code[fn_end] not in ('(', '\n'):
			fn_end += 1
		if code[fn_end] == '\n':
			log.error('yield* not followed by a function call?');
			raise NotImplementedError
		fn = code[fn_start:fn_end].strip()

		args_start = fn_end + 1
		args_end = args_start + 1
		while code[args_end] != ')':
			args_end += 1
		args = code[args_start:args_end]
		args = args.strip()
		args_end += 1


		# cb_arg = None
		# if '=' in before_text:
		# 	before_tokens = before_text.strip().split()
		# 	last = before_tokens.pop()
		# 	if last != '=':
		# 		log.error("Token other than '=' before yield*?")
		# 		raise NotImplementedError
		# 	if len(before_tokens > 2):
		# 		log.error("Too many tokens before yield*?")
		# 		log.error("Tokens: %s", before_tokens)
		# 		raise NotImplementedError
		# 	elif len(before_tokens == 2):
		# 		var = before_tokens.pop(0)
		# 		if var != 'var':
		# 			log.error("Expected token before yield* assignment to be 'var'")
		# 			log.error("It was instead: %s", var)
		# 			raise NotImplementedError
		# 	assert len(before_tokens == 1)
		# 	cb_arg = before_tokens.pop()
		# else:
		# 	if before_text.strip() != '':
		# 		log.error("yield* preceded by text that isn't assignment")
		# 		log.error("Could be a function call, we don't handle that")
		# 		log.error("Split into two lines and assign it to a variable")
		# 		raise NotImplementedError

		# if args:
		# 	code = code[:y] + 'convert_to_blocking(' + fn + ', ' + args + ')' + code[args_end:]
		# else:
		# 	code = code[:y] + 'convert_to_blocking(' + fn + ')' + code[args_end:]

		# Remove yield* either way so that loop completes; this way prints all
		# missing in one go
		code = code[:y] + code[fn_start:]
		if fn not in SUPPORTED_BLOCKING_FUNCTIONS:
			try:
				# Since calls block now, locally defined generators can be
				# safely reduced to regular functions, allow local definitions
				code.index('function ' + fn)
			except ValueError:
				log.error("Conversion requires unsupported blocking function: %s", fn)
				all_converted = False

	if not all_converted:
		raise NotImplementedError

	code += '\nprint("LOAD DONE");\n\n'
	log.debug("Successfully converted %s", accessor['name'])

	return code
