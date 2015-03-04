// name: ACme++
// author: Brad Campbell
// email:  bradjc@umich.edu

// ACme++
// ======
//
// ACme++ (AC Meter ++) is a power meter with an included relay.
//

var ip_addr;

function init () {
	// INTERFACES
	provide_interface('/onoff', {
		'/onoff.Power': PowerControl
	});
	provide_interface('/sensor/power', {
		'/sensor/power.Power': PowerMeter
	});

	ip_addr = get_parameter('ipv6_address');

	// Initialize the relay power state
	var response = yield* rt.coap.get('coap://['+ip_addr+']/onoffdevice/Power');
	set('PowerControl', (response == 'true'));
}

function* PowerControl (state) {
	yield* rt.coap.post('coap://['+ip_addr+']/onoffdevice/Power', (state)?'true':'false');

}

function* PowerMeter () {
	return yield* rt.coap.post('coap://['+ip_addr+']/powermeter/Power');
}
