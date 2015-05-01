
var _ = require('lodash');

var config = require('../config');

var accessors = require('accessors.io')(config.accessors.host_server);


function AccessorWrapper (path, parameters, finished) {

	var accessor;
	var inputs = {};
	this.inputs = inputs;

	var outputs = {};
	this.outputs = outputs;

	accessors.create_accessor(path, parameters, function (acc) {

		// Save the accessor
		accessor = acc;

		// Iterate all ports
		_.forEach(acc._meta.ports, function (port, index) {
			if (port.direction == 'input' || port.direction == 'inout') {
				// Map each input port to the correct function inside of the
				// accessor.
				inputs[port.function] = function (input) {
					acc[port.function](input);
				};
			}
		});

		// Let the setup know that we are done with initing the accessor
		finished();
	});

	// Setup the observable ports in the run function so that they don't
	// send packets too early
	this.run = function () {
		_.forEach(accessor._meta.ports, function (port, index) {
			if (port.direction == 'observable') {
				// Create intermediate callback function to call the correct
				// output callback function.
				accessor[port.function](function (data) {
					console.log('OBSERVED: ');
					console.log(data);
					outputs[port.function](data);
				});
			}
		});
	}

	this.about = {
		description: 'Include an accessor',
		inputs: {
			number: 'variable'
		},
		outputs: {
			number: 'variable'
		},
		parameters: 'Passed to the accessor'
	}
}

module.exports = AccessorWrapper;