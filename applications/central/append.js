var _ = require('lodash');

/* Create a APPEND block.
 *
 * Append data to packet and send it out.
 *
 */

/* parameters {
 *  append: {} to append
 * }
 */
function Append (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		console.log('APPEND: called');
		_.extend(data, parameters.append);
		console.log(data);
		outputs[0](data);
	}

	finished();
}

module.exports = Append;
