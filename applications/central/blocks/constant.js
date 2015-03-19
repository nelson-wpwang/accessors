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

module.exports = Constant;
