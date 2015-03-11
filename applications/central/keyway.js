var _ = require('lodash');

/* Create a KEYWAY block.
 *
 * This takes in a single json input, looks for a specific key, and
 * forwards the value of that key if found.
 *
 */

/* parameters {
 *  key:     the keyway block will look for this specific key in inputs
 * }
 */
function Keyway (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		if (_.has(data, parameters.key)) {
			// Key found, output the value
			console.log('KEYWAY: forwarding ' + val);
			outputs[0](data[parameters.key]);

		}
	}

	finished();
}

module.exports = Keyway;
