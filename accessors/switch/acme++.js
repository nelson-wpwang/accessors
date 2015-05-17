// name: ACme++
// author: Brad Campbell
// email:  bradjc@umich.edu

// ACme++
// ======
//
// ACme++ (AC Meter ++) is a power meter with an included relay.
//

var ip_addr;

function* init () {
	// INTERFACES
	provide_interface('/onoff', {
		'/onoff.Power': PowerControl
	});
	provide_interface('/sensor/power', {
		'/sensor/power.Power': PowerMeter
	});

	ip_addr = get_parameter('ip_addr');

	// Initialize the relay power state
	// var response = yield* rt.coap.get('coap://['+ip_addr+']/onoff/Power');
	// set('PowerControl', (response == 'true'));
}

PowerControl.input = function* (state) {
	yield* rt.coap.post('coap://['+ip_addr+']/onoff/Power', (state)?'true':'false');

}

PowerMeter.output = function* () {
	return yield* rt.coap.post('coap://['+ip_addr+']/powermeter/Power');
}
