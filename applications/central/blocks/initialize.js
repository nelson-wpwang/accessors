var _ = require('lodash');

/* Create a INTIALIZE block.
 *
 */

function Initialize (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	run = function () {
		console.log('INITIALIZE: running at start');
		outputs[0](null);
	}
	this.run = run;

	finished();
}

var about = {
	description:
"On boot, output a pulse.",
	ports: {
		outputs: {
			number: 1
		}
	}
};

module.exports.block = Initialize;
module.exports.about = about;
