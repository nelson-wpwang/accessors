
var accessors = require('accessors')('http://localhost:6565');


function AccessorWrapper (path, parameters, finished) {
	
	var inputs = new Array(1);
	this.inputs = inputs;

	accessors.create_accessor(path, parameters, function (acc) {
		inputs[0] = function (c) {
			// Hard coded for now
			acc.Print(c);
		}

		// Let the setup know that we are done with initing the accessor
		finished();
	});

}

module.exports = AccessorWrapper;