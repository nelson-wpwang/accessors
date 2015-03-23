var _ = require('lodash');

/* Create a DELAY block.
 *
 * Outputs a message after a certain delay.
 *
 * The input packet must be an object with at least the following keys:
 *  {
 *    delay: <milliseconds>    // how long to delay sending the output packet.
 *  }
 *
 */

function Delay (parameters, finished) {

	var outputs = {};
	this.outputs = outputs;

	var inputs = {};
	this.inputs = inputs;

	// Useful for killing the callback
	var timeout_object = null;

	// What to send on when the callback fires
	var delayed_message;

	// Callback after the timeout
	function delayed () {
		console.log('DELAY: callback fired')
		timeout_object = null;
		outputs[0](delayed_message);
	}

	inputs[0] =
	function (delay_pkt) {
		console.log('DELAY: ');
		console.log(delay_pkt);
		// Check that the delay packet has what we need
		if (_.has(delay_pkt, 'delay')) {
			console.log('DELAY: configuring delay');
			if (timeout_object != null) {
				console.log('DELAY: clearing old timeout');
				clearTimeout(timeout_object);
			}
			// Delay of -1 just means cancel the callback, so don't setup
			// a new callback if the delay is 0 or greater
			if (delay_pkt.delay >= 0) {
				console.log('DELAY: setting up callback for ' + delay_pkt.delay);
				delayed_message = delay_pkt;
				timeout_object = setTimeout(delayed, delay_pkt.delay);
			}
		}
	}

	this.about = {
		description: 'Delay outputting a packet for a specified time.\
The incoming packet must be an object that includes a key "delay" that specifies
how long to delay the packet.',
		ports: {
			inputs: {
				number: 1,
				ports: [{type: 'object'}]
			},
			outputs: {
				number: 1,
				ports: [{type: 'object'}]
			}
		}
	}

	finished();
}

module.exports = Delay;
