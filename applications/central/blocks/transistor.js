/* Create a TRANSITOR block.
 *
 * Acts as an nfet. When the gate is high it passes data packets through.
 * When the gate is low, it doesn't.
 *
 */

function Transistor (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	// Initialize the transistor to on
	var gate_high = true;

	inputs['in'] =
	function (data) {
		if (gate_high) {
			// When the nfet gate is high pass the incoming data through
			outputs['out'](data);
		} else {
			console.log('TRANSISTOR: not forwarding');
		}
	}

	inputs['gate'] =
	function (gate) {
		if (gate) {
			console.log('TRANSISTOR: setting on');
			gate_high = true;
		} else {
			console.log('TRANSISTOR: setting off');
			gate_high = false;
		}
	}

	finished();
}

module.exports = Transistor;
