var _ = require('lodash');

/* Create a THRESHOLD block.
 *
 * This outputs true if the value is above the threshold
 * and false if the value is below the threshold.
 *
 */

/* parameters {
 *  threshold: threshold to compare against
 * }
 */
function Threshold (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		console.log('THRESHOLD: called');
		if (data > parameters.threshold) {
			outputs[0](true);
		} else {
			outputs[0](false);
		}
	}

	this.about = {
		description:
"Check if the incoming value is above a predetermined threshold. Outputs true \
if it is, false otherwise.",
		ports: {
			inputs: {
				number: 1,
				ports: [{type: 'number'}]
			},
			outputs: {
				number: 1,
				ports: [{type: 'boolean'}]
			}
		},
		parameters: {
			threshold: 'The value to compare against.'
		}
	}

	finished();
}

module.exports = Threshold;
