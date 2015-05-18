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
		console.log('KEYWAY: called');
		if (_.has(data, parameters.key)) {
			// Key found, output the value
			console.log('KEYWAY: forwarding ' + data[parameters.key]);
			outputs[0](data[parameters.key]);
		}
	}

	finished();
}

var about = {
	name: 'Keyway',
	description:
"Takes in an object and outputs the value of the specified key.",
	ports: {
		inputs: {
			number: 1,
			ports: [{type: 'object'}]
		},
		outputs: {
			number: 1
		}
	},
	parameters: {
		key: 'Which key\'s value to extract from the object.'
	}
};

module.exports.block = Keyway;
module.exports.about = about;
