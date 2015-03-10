
var _ = require('lodash');

var config = require('./config');

var accessors = require('accessors')(config.accessors.host_server);


function AccessorWrapper (path, parameters, finished) {

	var accessor;
	var inputs = [];
	this.inputs = inputs;

	var outputs = [];
	this.outputs = outputs;

	accessors.create_accessor(path, parameters, function (acc) {

		// Save the accessor
		accessor = acc;

		// Iterate all ports
		_.forEach(acc._meta.ports, function (port, index) {
			if (port.direction == 'input') {
				// Map each input port to the correct function inside of the
				// accessor.
				inputs.push(function (input) {
					acc[port.name](input);
				});

			} else if (port.direction == 'observable') {
				// Create intermediate callback function to call the correct
				// output callback function.
				acc[port.name](function (data) {
					outputs[port.name](data);
				});
			}

		});

		// Let the setup know that we are done with initing the accessor
		finished();
	});

}

module.exports = AccessorWrapper;