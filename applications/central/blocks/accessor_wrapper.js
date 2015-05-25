
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

	// This function gives us this semantics:
	// If an output port (that is not an observe port) is wired to something,
	// then have it call that something when any inputs change.
	function execute_all_connected_outputs () {
		_.forEach(accessor._meta.ports, function (port, index) {
			if (port.directions.indexOf('output') > -1 &&
				port.directions.indexOf('observe') == -1 &&
				port.name in outputs) {

				_.result(accessor, port.function).output(function (ret) {
					outputs[port.name](ret);
				});
			}
		});
	}

	accessors.create_accessor(path, parameters, function (acc) {

		// Save the accessor
		accessor = acc;

		// Iterate all ports
		_.forEach(acc._meta.ports, function (port, index) {
			if (port.directions.indexOf('input') > -1) {
				// Map each input port to the correct function inside of the
				// accessor.
				inputs[port.name] = function (input) {
					_.result(acc, port.function).input(input, function () {
						execute_all_connected_outputs();
					});
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
				_.result(accessor, port.function).observe(function (data) {
					info('OBSERVED: ');
					info(data);
					outputs[port.name](data);
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
