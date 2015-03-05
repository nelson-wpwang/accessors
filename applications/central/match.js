var _ = require('lodash');

/* Create a MATCH block.
 *
 * This takes in a single input, compares the input to its match table,
 * and calls the matching callback function with the value true.
 *
 */

/* parameters[key]:       the match block will use the value that corresponds to this key
 *            in the incoming dict when performing the match.
 * parameters[matches]:   an array of strings that the match block will compare the value
 *            against.
 * callbacks: an array of callback functions. The one that corresponds to the
 *            matched value will be called with `true`.
 */
function Match (parameters) {

	var outputs = new Array(parameters.matches.length);
	this.outputs = outputs;

	var inputs = [

		function (data) {
			if (_.has(data, parameters.key)) {
				// Can even try to match this key
				var val = data[parameters.key];

				_.forEach(parameters.matches, function (match_str, n) {
					if (match_str == val) {
						// Call the correct output
						if (outputs[n]) {
							outputs[n](true);
						}

						// Stop looking for matches
						return false;
					}
				});
			}
		}

	]
	this.inputs = inputs;

}



module.exports = Match;
