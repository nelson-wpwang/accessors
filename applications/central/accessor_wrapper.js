
var _ = require('lodash');

var accessors = require('accessors')('http://localhost:6565');


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
			if (port.type == 'input') {
				// Map each input port to the correct function inside of the
				// accessor.
				inputs.push(function (input) {
					acc[port.name]();
				});
			
			} else if (port.type == 'observable') {
				// Create intermediate callback function to call the correct
				// ouput callback function.
				acc[port.name](function (data) {
					outputs[port.name](data);
				});
			}

		});



		// inputs[0] = function (c) {
		// 	// Hard coded for now
		// 	acc.Print(c);
		// }

		// Let the setup know that we are done with initing the accessor
		finished();
	});

}

module.exports = AccessorWrapper;