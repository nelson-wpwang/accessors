#!/usr/bin/env node

var readline = require('readline');

var _ = require('lodash');
var async = require('async');

var config = require('./config');

var accessors = require('accessors')(config.accessors.host_server);


var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});


// Ask for which accessor we want to interact with
rl.question('Accessor path: ', function (path) {

	// Request info about that accessor (basically so we can determine
	// which parameters to ask for)
	accessors.get_accessor_ir(path, function (accessor_ir) {

		// Ask the user for all parameters
		var parameters = {};

		if (accessor_ir.parameters.length > 0) {
			console.log('Please enter parameters: ');
		}

		var f = [];
		_.forEach(accessor_ir.parameters, function (param, index) {
			f.push(function (cb) {
				rl.question('  ' + param.name + ': ', function (answer) {
					parameters[param.name] = answer;
					cb();
				});
			});
		});

		async.series(f, function (err, results) {

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

				function interact () {
					rl.question('[get, set, listen]: ', function (cmd) {
						rl.question('port index: ', function (pi) {
							var port_index = parseInt(pi);
							if (cmd == 'get') {
								console.log(accessor[accessor_ir.ports[port_index].function]());
								interact();
							} else if (cmd == 'set') {
								rl.question('value: ', function (val) {
									if (val == 'true') {
										val = true;
									} else if (val == 'false') {
										val = false;
									}
									accessor[accessor_ir.ports[port_index].function](val);
									interact();
								});
							} else if (cmd == 'listen') {
								accessor[accessor_ir.ports[port_index].function](subscribe_callback);
							} else {
								interact();
							}
						});
					});
				}
				interact();

			},
			function (error) {
				console.log('could not create accessor');
				console.log(error);
			});
		});

	},
	function (error) {
		console.log('ERROR');
		console.log(error);
	});
});
