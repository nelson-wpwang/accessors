#!/usr/bin/env node

/* Interact with an accessor via a command line interface.
 * Can use accessors in a host server or locally defined accessors.
 */

var accessors = require('accessors.io');

var fs        = require('fs');
var _         = require('lodash');
var async     = require('async');
var readline  = require('readline-sync');
var argv      = require('yargs')
                       .usage('Usage: $0 [accessor]')
                       .example('$0', 'Choose an accessor from a list to execute.')
                       .example('$0 /path/to/MyNewAccessor.js', 'Run a local accessor file.')
                       .example('$0 --no-save', 'Newly created devices will not have their parameters stored.')
                       .options(_.assign({
                        		'no_save': {
                        			describe: 'Do not save entered parameters in a local .json file.',
                        			type: 'boolean'
                        		},
                        		'parameters': {
                        			describe: 'Path of a parameters .json file.',
                        			type: 'string',
                        			default: './accessors-cli-parameters.json'
                        		}
                        	},
                        	accessors.options))
                       .help('h')
                       .alias('h', 'help')
                       .argv;

var saved_parameters = {}


function console_from_ir (accessor_id, accessor_ir) {


	// Ask the user for all parameters
	var saved_device = false; // keep track of if we know about this device
	var parameters = {};
	if (accessor_ir.parameters.length > 0) {

		// Check to see if we have any saved parameters for this accessor
		if (accessor_id in saved_parameters) {
			while (true) {
				console.log('Found the following saved instances:');
				for (var i=0; i<saved_parameters[accessor_id].length; i++) {
					var saved_entry = saved_parameters[accessor_id][i];
					process.stdout.write(i+':  ');

					var j = 0;
					for (var parameter_name in saved_entry.parameters) {
						if (saved_entry.parameters.hasOwnProperty(parameter_name)) {
							if (j != 0) process.stdout.write('    ');
							console.log(parameter_name + ': ' + saved_entry.parameters[parameter_name]);
							j += 1;
						}
					}
				}
				console.log(i+':  Create New');

				var answer = parseInt(readline.question('Which device: '));
				if (isNaN(answer) || answer < 0 || answer > saved_parameters[accessor_id].length + 1) {
					console.log('Invalid entry, try again.');
				} else {
					break;
				}
			}

			if (answer < saved_parameters[accessor_id].length) {
				// Use saved parameters
				parameters = saved_parameters[accessor_id][answer].parameters;
				saved_device = true;
			}
		}
		if (!(accessor_id in saved_parameters) || answer >= saved_parameters[accessor_id].length) {
			// Use new parameters
			console.log('Please enter parameters: ');
			for (var i=0; i<accessor_ir.parameters.length; i++) {
				var param = accessor_ir.parameters[i];
				var answer = readline.question('  ' + param.name + ': ');
				parameters[param.name] = answer;
			}
		}
	}

	// Now actually ask questions about the accessor for interacting with
	console.log('Getting real accessor.');

	accessors.load_accessor(accessor_ir, parameters, function (accessor) {

		// Successfully loaded this device. If this is new and we are saving,
		// now would be a good time to save it.
		if (!argv.no_save && !saved_device) {
			if (!(accessor_id in saved_parameters)) {
				saved_parameters[accessor_id] = [];
			}
			saved_parameters[accessor_id].push({
				parameters: parameters
			});
			fs.writeFileSync(argv.parameters, JSON.stringify(saved_parameters));
		}

		console.log('Ports:');
		for (var i=0; i<accessor_ir.ports.length; i++) {
			console.log('  ' + i + ': ' + accessor_ir.ports[i].function);
		}

		function subscribe_callback (data) {
			console.log(data);
		}

		function interact (val) {
			// We call interact as the success callback. We may
			// have succeeded in getting something from the device
			if (val !== undefined) {
				console.log('GOT: ' + val);
			}

			var port_index = parseInt(readline.question('port index: '));
			if (isNaN(port_index) || port_index < 0 || port_index >= accessor_ir.ports.length) {
				console.log('Invalid port index');
				interact();
			} else {
				var port = accessor_ir.ports[port_index];
				var cmd;

				// Ask the user how to interact with the port
				var question = 'choose a direction: [';
				if (port.directions.indexOf('output') > -1) {
					question += 'get, ';
					cmd = 'get';
				}
				if (port.directions.indexOf('input') > -1) {
					question += 'set, ';
					cmd = 'set';
				}
				if (port.directions.indexOf('observe') > -1) {
					question += 'listen, ';
					cmd = 'listen';
				}
				question = question.substring(0, question.length-2) + ']: ';

				// If it's ambiguous ask, otherwise choose the only option.
				if (port.directions.length > 1) {
					cmd = readline.question(question);
				}

				// Feels like there should be some idiomatic JS way to index
				// down several object levels, but I don't know it and this works
				var temp = port.function.split('.');
				port_obj = accessor[temp.shift()];
				while (temp.length) port_obj = port_obj[temp.shift()];

				if (cmd == 'get') {
					port_obj.output(interact, function (err) {
						console.log('CLI: error ' + err);
					});
				} else if (cmd == 'set') {
					var val = readline.question('value: ');
					if (val == 'true') {
						val = true;
					} else if (val == 'false') {
						val = false;
					}
					port_obj.input(val, interact);
				} else if (cmd == 'listen') {
					port_obj.observe(subscribe_callback);
				} else {
					console.log('"'+cmd+'" is not a valid choice');
					interact();
				}
			}
		}
		interact();

	},
	function (error) {
		console.log('could not create accessor');
		console.log(error);
	});
}

// Read in any save parameters
// Format:
// {
// 	'<accessor path>': [
//		{
// 			'parameters': {
// 				'<parameter name>': '<parameter value>'
// 			}
// 		}
//	]
// }
if (fs.existsSync(argv.parameters)) {
	saved_parameters = JSON.parse(fs.readFileSync(argv.parameters));
}

// This tool supports pulling an accessor from the host server or from
// a local file.
if (argv._.length == 0) {
	// Use the host server. Allow the user to choose from a list.

	// Get list of all valid accessors
	accessors.get_accessor_list(function (accessor_list) {
		accessor_list_sorted = accessor_list.sort()

		for (var i=0; i<accessor_list_sorted.length; i++) {
			console.log(i+':  '+accessor_list_sorted[i]);
		}

		// Ask for which accessor we want to interact with
		var index = parseInt(readline.question('Which accessor: '));
		var path = accessor_list_sorted[index];

		// Request info about that accessor (basically so we can determine
		// which parameters to ask for)

		accessors.get_accessor_ir(path, function (accessor_ir) {
			console_from_ir(path, accessor_ir);
		},
		function (error) {
			console.log('Error getting accessor IR');
			console.log(error);
		});
	},
	function (error) {
		console.log(error);
	});
} else {
	// Use a local file as an accessor
	var accessor_local_path = argv._[0];
	console.log('Loading and running ' + accessor_local_path);
	accessors.compile_dev_accessor(accessor_local_path, function (dev_uuid) {

		console.log('Created new development accessor!');
		console.log('To view more information about the accessor, please view');
		console.log('')
		console.log('  ' + accessors.get_host_server() + '/dev/view/accessor/' + dev_uuid);
		console.log('')

		accessors.get_dev_accessor_ir(dev_uuid, function (accessor_ir) {
			console_from_ir(accessor_local_path, accessor_ir);
		},
		function (error) {
			console.log('Error getting dev accessor IR');
			console.log(error);
		});
	},
	function (error, dev_uuid) {
		if (dev_uuid) {
			console.log('Failed to parse and create an accessor object from that accessor.');
			console.log('To view the errors, please view');
			console.log('');
			console.log('  ' + accessors.get_host_server() + '/dev/view/accessor/' + dev_uuid);
			console.log('')
		} else {
			console.log('An error occurred when trying to contact the host server.')
			console.log('Perhaps it\'s down?.')
		}
	});
}
