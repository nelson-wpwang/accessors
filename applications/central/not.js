var _ = require('lodash');

/* Create a NOT block.
 *
 * This takes in a single input and inverts it. true->false, false->true
 *
 */

/* callback: what to call with the inverted value
 */
function Not () {

	var outputs = new Array(1);
	this.outputs = outputs;

	var inputs = [

        function (bool) {
			if (bool) {
				outputs[0](false);
			} else {
				outputs[0](true);
			}
		}

	]
	this.inputs = inputs;
	
}

module.exports = Not;
