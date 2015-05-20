
var debug   = require('debug');

var _       = require('lodash');

// var accessors = require('accessors.io')(config.accessors.host_server);
var accessors = require('accessors.io');

info = debug('accessorsCentral:info');
error = debug('accessorsCentral:error');

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
			if (port.directions.indexOf('input') > -1) {
				// Map each input port to the correct function inside of the
				// accessor.
				inputs[port.function] = function (input) {
					acc[port.function].input(input);
				};
			}
		});

		// Let the setup know that we are done with initing the accessor
		finished();
	},
	function (err) {
		console.log('Could not create accessor ' + path);
		error(err);
	});

	// Setup the observable ports in the run function so that they don't
	// send packets too early
	var run = function () {
		_.forEach(accessor._meta.ports, function (port, index) {
			if (port.directions.indexOf('observe') > -1) {
				accessor[port.function].observe(function (data) {
					info('OBSERVED: ');
					info(data);
					outputs[port.function](data);
				});
			}
		});
	}
	this.run = run;
}

var about = {
	description: 'Include an accessor',
	inputs: {
		number: 'variable'
	},
	outputs: {
		number: 'variable'
	},
	parameters: 'Passed to the accessor'
};

module.exports.block = AccessorWrapper;
module.exports.about = about;
