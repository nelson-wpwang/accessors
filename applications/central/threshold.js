var _ = require('lodash');

/* Create a THRESHOLD block.
 *
 * This outputs true if the value on the correct key is above the threshold
 * and false if the value is below the threshold.
 *
 */

/* parameters {
 *  key:  key whose value we are looking at
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
		if (_.has(data, parameters.key)) {
			if (data[parameters.key] > parameters.threshold) {
				outputs[0](true);
			} else {
				outputs[0](false);
			}
		}
	}

	finished();
}

module.exports = Threshold;
