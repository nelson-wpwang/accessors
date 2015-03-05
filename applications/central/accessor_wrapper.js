
var accessors = require('accessors')('http://localhost:6565');


function AccessorWrapper (path, parameters) {
	
	var inputs = new Array(1);
	this.inputs = inputs;

	accessors.create_accessor(path, parameters, function (acc) {
		console.log('CREATED ACCESSOR')
		inputs[0] = function (c) {
			console.log('at accessor: ' + c);
		}
	});

}

module.exports = AccessorWrapper;