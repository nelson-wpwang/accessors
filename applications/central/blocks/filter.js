var _ = require('lodash');

/* Create a FILTER block.
 *
 * This passes all inputs to its output that have the correct key:value pairs
 * in it.
 *
 */

/* parameters {
 *  filters:  array of key:value pairs that need to be in the incoming data
 * }
 */
function Filter (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		console.log('FILTER: called');
		match = true;
		for (var i=0; i<parameters.filters.length; i++) {
			console.log('FILTER trying ' + parameters.filters[i]);
			if (!_.has(data, parameters.filters[i][0])) {
				match = false;
				break;
			}
			if (data[parameters.filters[i][0]] != parameters.filters[i][1]) {
				match = false;
				break;
			}
		}
		if (match) {
			// Key found, output the value
			console.log('FILTER: forwarding ' + data);
			outputs[0](data);
		}
	}

	this.about = {
		description:
"Only pass through packets that have the correct key:value pairs in them.",
		ports: {
			inputs: {
				number: 1,
				ports: [{type: 'object'}]
			},
			outputs: {
				number: 1,
				ports: [{type: 'object'}]
			}
		},
		parameters: {
			filters: {
				help: 'Array of key:value pairs.',
				type: 'keyvalue_array'
			}
		}
	}

	finished();
}

module.exports = Filter;
