var _ = require('lodash');

/* Create a PRINT block.
 *
 */

function Print (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		console.log('PRINT: called');
		console.log(data);
	}

	finished();
}

var about = {
	description:
"Print whatever comes in.",
	ports: {
		inputs: {
			number: 1
		}
	}
};

module.exports.block = Print;
module.exports.about = about;
