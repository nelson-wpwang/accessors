#!/usr/bin/env node

var _ = require('lodash');
var async = require('async');
var readline = require('readline-sync');

var accessors = require('accessors.io');


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

		// Ask the user for all parameters
		var parameters = {};

		if (accessor_ir.parameters.length > 0) {
			console.log('Please enter parameters: ');
		}

		for (var i=0; i<accessor_ir.parameters.length; i++) {
			var param = accessor_ir.parameters[i];
			var answer = readline.question('  ' + param.name + ': ');
			parameters[param.name] = answer;
		}

		// Now actually ask questions about the accessor for interacting with
		console.log('Getting real accessor.');

		accessors.create_accessor(path, parameters, function (accessor) {
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

	},
	function (error) {
		console.log('ERROR');
		console.log(error);
	});

},
function (error) {
	console.log(error);
});
