var _ = require('lodash');

/* Create a MATCH block.
 *
 * This takes in a single input, compares the input to its match table,
 * and calls the matching callback function with the value true.
 *
 */

/* parameters {
 *  matches: an array of strings that the match block will compare the value
 *           against.
 * }
 */
function Match (parameters, finished) {

	// var outputs = new Array(parameters.matches.length);
	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	inputs[0] =
	function (data) {
		console.log('MATCH: trying to match ' + data);

		_.forEach(parameters.matches, function (match_str, n) {
			if (match_str == data) {
				console.log('MATCH: Matched['+n+']');
				// Call the correct output
				if (outputs[n]) {
					outputs[n](true);
				}

				// Stop looking for matches
				return false;
			}
		});
	}

	finished();
}

var about = {
	name: 'Match',
	description:
"Compare an input string and output true if the string matches.",
	ports: {
		inputs: {
			number: 1,
			ports: [{type: 'string'}]
		},
		outputs: {
			number: 1,
			ports: [{type: 'boolean'}]
		}
	},
	parameters: {
		matches: {
			help: 'Array of strings to compare against.',
			type: 'string_array'
		}
	}
}

module.exports.block = Match;
module.exports.about = about;
