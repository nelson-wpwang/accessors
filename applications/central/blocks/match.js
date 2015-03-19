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

module.exports = Match;
