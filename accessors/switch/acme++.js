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
	if (response == 'true') {
		set('PowerControl', true);
	} else {
		set('PowerControl', false);
	}
}

function* PowerControl (state) {
	if (state) {
		yield* rt.coap.post('coap://['+ip_addr+']/onoffdevice/Power', 'true');
	} else {
		yield* rt.coap.post('coap://['+ip_addr+']/onoffdevice/Power', 'false');
	}
}

function* PowerMeter (state) {
	// n.b. This query isn't implemented, but proving the port alias concept
	yield* meter_socket.sendto('\x10', [ip_addr, 47652]);
	set('/sensor/power.Power', yield* meter_socket.recieveInt());
}
