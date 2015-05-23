#!/usr/bin/env node

var readline = require('readline');

var _ = require('lodash');
var async = require('async');

var accessors = require('accessors.io');

// Used to prompt for questions
var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});


// Get list of all valid accessors
accessors.get_accessor_list(function (accessor_list) {
	accessor_list_sorted = accessor_list.sort()

	for (var i=0; i<accessor_list_sorted.length; i++) {
		console.log(i+':  '+accessor_list_sorted[i]);
	}

	// Ask for which accessor we want to interact with
	rl.question('Which accessor: ', function (index) {
		index = parseInt(index);
		var path = accessor_list_sorted[index];

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

					function interact (val) {
						// We call interact as the success callback. We may
						// have succeeded in getting something from the device
						if (val !== undefined) {
							console.log('GOT: ' + val);
						}

						rl.question('port index: ', function (pi) {
							var port_index = parseInt(pi);
							if (port_index < 0 || port_index >= accessor_ir.ports.length) {
								console.log('Invalid port index');
								interact();
							} else {
								var port = accessor_ir.ports[port_index];
								var question = 'choose a direction: [';
								if (port.directions.indexOf('output') > -1) {
									question += 'get, ';
								}
								if (port.directions.indexOf('input') > -1) {
									question += 'set, ';
								}
								if (port.directions.indexOf('observe') > -1) {
									question += 'listen, ';
								}

								question = question.substring(0, question.length-2) + ']: ';
								rl.question(question, function (cmd) {

									if (cmd == 'get') {
										accessor[port.function].output(interact, function (err) {
											console.log('CLI: error ' + err);
										});
									} else if (cmd == 'set') {
										rl.question('value: ', function (val) {
											if (val == 'true') {
												val = true;
											} else if (val == 'false') {
												val = false;
											}
											accessor[port.function].input(val, interact);
										});
									} else if (cmd == 'listen') {
										accessor[port.function].observe(subscribe_callback);
									} else {
										console.log('"'+cmd+'" is not a valid choice');
										interact();
									}
								});
							}
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

},
function (error) {
	console.log(error);
});
