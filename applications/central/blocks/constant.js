var _ = require('lodash');

/* Create a CONSTANT block.
 *
 * Output a constant anytime any data comes in on the input.
 *
 */

/* parameters {
 *  constant: value to output
 * }
 */
function Constant (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		console.log('CONSTANT: called');
		outputs[0](parameters.constant);
	}

	finished();
}

var about = {
	description:
"When anything is received on the input, output a constant value.",
	ports: {
		inputs: {
			number: 1
		},
		outputs: {
			number: 1
		}
	},
	parameters: {
		constant: 'The value/object to output.'
	}
};

module.exports.block = Constant;
module.exports.about = about;
