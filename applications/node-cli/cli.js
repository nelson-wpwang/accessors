#!/usr/bin/env node
'use strict';

/* Interact with an accessor via a command line interface.
 * Can use accessors in a host server or locally defined accessors.
 */


var accessors = require('accessors.io');

var blessed   = require('blessed');
var fs        = require('fs');
var colors    = require('colors');
var _         = require('lodash');
var _eval     = require('eval');
var async     = require('async');
var debug_lib = require('debug');
var readline  = require('readline-sync');
var sf        = require('stringformat');
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

// Configure debugging
if (argv.debug) {
	debug_lib.enable('accessors-cli.*');
}
var info = debug_lib('accessors-cli:info');
var error = debug_lib('accessors-cli:error');
var debug = debug_lib('accessors-cli:debug');

var MAX_DISPLAY_LINES = 500;

function cli_log (s) {
	bottom.insertBottom(s);

	var numlines = bottom.getLines().length;
	while (numlines > MAX_DISPLAY_LINES) {
		bottom.deleteTop();
		numlines -= 1;
	}
}

debug_lib.log = cli_log

// Get some python like .format action
sf.extendString();

// Setup curses like windows
// We need this because it allows us to read input while also
// printing output.
var screen = blessed.screen();
var top = null;

var bottom = blessed.log({
	parent: screen,
	mouse: true,
	keys: true,
	top: '25%',
	left: 0,
	width: '100%',
	height: '75%',
	border: {
		type: 'line',
		fg: 'black'
	},
	scrollbar: {
		bg: 'blue'
	}
});

// Exit on ctrl-c
screen.key('C-c', function () {
	process.exit(0);
});

// So we don't have to type in parameters every time
var saved_parameters = {}

// Got parameters and all that, now actually interact with the device
function load_accessor (accessor_id, accessor_ir, parameters, saved_device) {

	accessors.load_accessor(accessor_ir, parameters, function (err, accessor) {

		if (!err) {
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
		}

		accessor.init(function (err) {

			if (err) {
				console.log('ERROR'.red);
				error(err);

				console.log('Failed when creating an accessor.');
				console.log('Likely this is an error inside of the init() function.');
				console.log(err);
				return;
			}

			function subscribe_callback (err, data) {
				bottom.insertBottom('CLI: got event callback'.blue);
				if (err) {
					error('CLI: event callback error: ' + err);
				} else {
					if (typeof data === 'object') {
						bottom.insertBottom(JSON.stringify(data));
					} else {
						bottom.insertBottom(data + '');
					}
				}
			}

			function interact (err, val) {
				if (err) {
					error('CLI: error ' + err);
				}
				// We call interact as the success callback. We may
				// have succeeded in getting something from the device
				if (val !== undefined) {
					bottom.insertBottom('Returned from accessor: '.magenta + val);
				}

				// Display a list of ports
				top = blessed.list({
					parent: screen,
					keys: true,
					mouse: true,
					top: 0,
					left: 0,
					width: '100%',
					height: '25%',
					content: 'huh??',
					border: {
						type: 'line',
						fg: 'black'
					},
					selectedBg: 'blue',
					selectedFg: 'white'
				});

				var ports = [];
				for (var i=0; i<accessor_ir.ports.length; i++) {
					ports.push(accessor_ir.ports[i].name);
				}

				var title = 'Select a port:';
				top.setItems([title.bold].concat(ports));

				// Select a port
				top.once('select', function (val, index) {
					screen.remove(top);

					if (index == 0) {
						interact();
						return;
					}

					var port = accessor_ir.ports[index-1];

					top = blessed.list({
						parent: screen,
						keys: true,
						mouse: true,
						top: 0,
						left: 0,
						width: '100%',
						height: '25%',
						border: {
							type: 'line',
							fg: 'black'
						},
						selectedBg: 'blue',
						selectedFg: 'white'
					});

					var options = [];

					// Determine what we can do with this port
					if (port.directions.indexOf('output') > -1) {
						if (port.attributes.indexOf('event') > -1) {
							options.push('listen');
						}
						if (port.attributes.indexOf('read') > -1) {
							options.push('get');
						}
					}
					if (port.directions.indexOf('input') > -1) {
						options.push('set');
					}

					title = 'How do you want to interact with the port: ';
					top.setItems([title.bold].concat(options));

					// Select an action to do on the port
					top.once('select', function (val, index) {
						screen.remove(top);

						if (index == 0) {
							interact();
							return;
						}

						var action = options[index-1];

						// Respond based on the different actions
						if (action == 'get') {
							accessor.read(port.name, interact);

						} else if (action == 'set') {

							if (port.type === 'button') {
								// We don't need a value if this is just
								// a button
								accessor.write(port.name, null, interact);
							} else {

								// Set it up so we can write to the device
								top = blessed.form({
									parent: screen,
									keys: true,
									mouse: true,
									top: 0,
									left: 0,
									width: '100%',
									height: '25%',
									border: {
										type: 'line',
										fg: 'black'
									}
								});

								var t = blessed.text({
									parent: top,
									content: 'Value: ',
									left: 0,
									top: 0
								});

								var p = blessed.textbox({
									parent: top,
									mouse: true,
									keys: true,
									shrink: true,
									inputOnFocus: true,
									left: 7,
									top: 0
								});
								p.focus();

								var done = blessed.button({
									parent: top,
									mouse: true,
									keys: true,
									shrink: true,
									left: 0,
									top: 1,
									name: 'Done',
									content: 'Done',
									style: {
										bg: 'lightgray',
										fg: 'black',
										hover: {
											bg: 'blue',
											fg: 'white'
										},
										focus: {
											bg: 'blue',
											fg: 'white'
										},
									}
								});

								done.once('press', function () {
									top.submit();
								});

								top.once('submit', function (data) {
									screen.remove(top);
									var val = data.textbox;

									if (val == 'true') {
										val = true;
									} else if (val == 'false') {
										val = false;
									} else if (port.type == 'object' || 'bundles_ports' in port) {
										val = _eval('exports.val='+val).val;
									}

									accessor.write(port.name, val, interact);
								});

								screen.render();
							}

						} else if (action == 'listen') {
							accessor.on(port.name, subscribe_callback);
							console.log('Added subscription to port'.magenta);
							interact();
						}
					});

					top.down(1);
					screen.render();
					top.focus();

				});

				top.down(1);
				screen.render();
				top.focus();

			}
			interact();
		});

	});
}

function enter_parameters (accessor_id, accessor_ir) {
	var parameters = {};

	top = blessed.form({
		parent: screen,
		keys: true,
		mouse: true,
		top: 0,
		left: 0,
		width: '100%',
		height: '25%',
		border: {
			type: 'line',
			fg: 'black'
		},
		content: 'Please enter the parameters: '
	});

	for (var i=0; i<accessor_ir.parameters.length; i++) {
		var param = accessor_ir.parameters[i];

		var t = blessed.text({
			parent: top,
			content: param.name + ':',
			left: 5,
			top: i+1
		});

		var p = blessed.textbox({
			parent: top,
			mouse: true,
			keys: true,
			shrink: true,
			inputOnFocus: true,
			content: param.name + ':',
			left: 7+param.name.length,
			top: i+1
		});
		if (i==0) {
			p.focus();
		}
	}

	var done = blessed.button({
		parent: top,
		mouse: true,
		keys: true,
		shrink: true,
		left: 0,
		top: i+2,
		name: 'Done',
		content: 'Done',
		style: {
			bg: 'lightgray',
			fg: 'black',
			hover: {
				bg: 'blue',
				fg: 'white'
			},
			focus: {
				bg: 'blue',
				fg: 'white'
			},
		}
	});

	done.once('press', function () {
		top.submit();
	});

	top.once('submit', function (data) {
		for (var i=0; i<accessor_ir.parameters.length; i++) {
			var param = accessor_ir.parameters[i];
			if (accessor_ir.parameters.length == 1) {
				var p = data.textbox;
			} else {
				var p = data.textbox[i];
			}
			if (p !== '') {
				parameters[param.name] = p;
			}
		}
		screen.remove(top);
		load_accessor(accessor_id, accessor_ir, parameters, false);
	});

	screen.render();
}


function console_from_ir (accessor_id, accessor_ir) {
	// Ask the user for all parameters
	var parameters = {};
	if (accessor_ir.parameters.length > 0) {
		// Check to see if we have any saved parameters for this accessor
		if (accessor_id in saved_parameters) {
			info('Have saved copies of this device.');

			top = blessed.list({
				parent: screen,
				keys: true,
				mouse: true,
				top: 0,
				left: 0,
				width: '100%',
				height: '25%',
				border: {
					type: 'line',
					fg: 'black'
				},
				selectedBg: 'blue',
				selectedFg: 'white'
			});

			var saved_options = [];

			for (var i=0; i<saved_parameters[accessor_id].length; i++) {
			 	var saved_entry = saved_parameters[accessor_id][i];
			 	var option = '';

				for (var parameter_name in saved_entry.parameters) {
					if (saved_entry.parameters.hasOwnProperty(parameter_name)) {
						option += parameter_name + ': ' + saved_entry.parameters[parameter_name] + '; ';
					}
				}
				saved_options.push(option);
			}
			saved_options.push('Create New');

			var title = 'Select a saved device:';
			top.setItems([title.bold].concat(saved_options));

			top.once('select', function (val, index) {
				screen.remove(top);
				index -= 1;

				if (index < saved_parameters[accessor_id].length && index >= 0) {
					// Use the saved device
					parameters = saved_parameters[accessor_id][index].parameters;
					load_accessor(accessor_id, accessor_ir, parameters, true);

				} else {
					// Ask the user to enter parameters to create a new one
					enter_parameters(accessor_id, accessor_ir);
				}

			});

			top.down(1);
			screen.render();
			top.focus();

		} else {
			// None saved, need to get parameters
			enter_parameters(accessor_id, accessor_ir);
		}

	} else {
		load_accessor(accessor_id, accessor_ir, parameters, false);
	}
}

// Setup console.log
var print_functions = {
	console_log: function (val) { bottom.insertBottom(val); },
	console_info: function (val) { bottom.insertBottom(val); },
	console_error: function (val) { bottom.insertBottom(val); },
	debug: cli_log
}
accessors.set_output_functions(print_functions);

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

	top = blessed.list({
		parent: screen,
		keys: true,
		mouse: true,
		top: 0,
		left: 0,
		width: '100%',
		height: '25%',
		border: {
			type: 'line',
			fg: 'black'
		},
		selectedBg: 'blue',
		selectedFg: 'white'
	});

	screen.render();
	top.focus();

	// Get list of all valid accessors
	accessors.get_accessor_list(function (err, accessor_list) {
		if (err) {
			error('ERROR'.red);
			error(err);
			return;
		}

		var accessor_list_sorted = accessor_list.sort();

		function accessor_selected (val, index) {
			var path = accessor_list_sorted[index-1];

			info('Using accessor ' + path);

			accessors.get_accessor_ir(path, function (err, accessor_ir) {
				if (err) {
					error('ERROR'.red);
					error('Error getting accessor IR');
					error(err);
					top.once('select', accessor_selected);
				} else {
					screen.remove(top);
					console_from_ir(path, accessor_ir);
				}
			});
		}

		// Handle when items are selected in the top
		top.once('select', accessor_selected);

		var title = 'Select Accessor to use: ';
		top.setItems([title.bold].concat(accessor_list_sorted));

		top.down(1);
		screen.render();

	});
} else {
	// Use a local file as an accessor
	var accessor_local_path = argv._[0];
	console.log('[INFO]   '.blue + ' Loading and running ' + accessor_local_path);
	accessors.compile_dev_accessor(accessor_local_path, function (err, dev_uuid) {

		if (err) {
			if (dev_uuid) {
				error('ERROR'.red);
				error('Failed to parse and create an accessor object from that accessor.');
				error('To view the errors, please view');
				error('');
				error('  ' + accessors.get_host_server() + '/dev/view/accessor/' + dev_uuid);
				error('')
			} else {
				error('ERROR'.red);
				error('An error occurred when trying to contact the host server.')
				error('Perhaps it\'s down?')
			}

		} else {

			info('[SUCCESS]'.green + ' Created new development accessor!');
			info('To view more information about the accessor, please view');
			info('')
			info('  ' + accessors.get_host_server() + '/dev/view/accessor/' + dev_uuid);
			info('')

			accessors.get_dev_accessor_ir(dev_uuid, function (err, accessor_ir) {
				if (err) {
					error('ERROR'.red);
					error('Error getting dev accessor IR');
					error(err);

				} else {
					console_from_ir(accessor_local_path, accessor_ir);
				}
			});
		}
	});
}

screen.render();
