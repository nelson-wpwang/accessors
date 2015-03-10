var _ = require('lodash');

/* Create a NOT block.
 *
 * This takes in a single input and inverts it. true->false, false->true
 *
 */

/* callback: what to call with the inverted value
 */
function Not (parameters, finished) {

	// var outputs = new Array(1);
	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (bool) {
		console.log('NOT: got ' + bool);
		if (bool) {
			outputs[0](false);
		} else {
			outputs[0](true);
		}
	};

	finished();

}

module.exports = Not;
