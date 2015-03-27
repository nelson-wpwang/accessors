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

		var out;

		if (data === null) {
			out = parameters.append;

		} else if (typeof data === 'object') {
			_.extend(data, parameters.append);
			out = data;

		} else {
			out = data + parameters.append;
		}

		outputs[0](out);
	}

	this.about = {
		description:
"Add what is in parameters.append to the incoming data packet and push the \
packet to the output.",
		ports: {
			inputs: {
				number: 1
			},
			outputs: {
				number: 1
			}
		},
		parameters: {
			append: 'What to add to the data packet.'
		}
	}

	finished();
}

module.exports = Append;
