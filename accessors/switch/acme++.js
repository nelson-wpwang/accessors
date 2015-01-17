// name: ACme++
// author: Brad Campbell
// email:  bradjc@umich.edu

// ACme++
// ======
//
// ACme++ (AC Meter ++) is a power meter with an included relay.
//

var ip_addr;
var control_socket;
var meter_socket;

function init () {
	// INTERFACES
	provide_interface('/onoff', {
		'/onoff.Power': PowerControl
	});
	provide_interface('/sensor/power', {
		'/sensor/power.Power': PowerMeter
	});

	ip_addr = get_parameter('ipv6_address');

	try {
		control_socket = yield* rt.socket.socket('AF_INET6', 'SOCK_DGRAM');
		meter_socket = yield* rt.socket.socket('AF_INET6', 'SOCK_DGRAM');
	} catch (err) {
		rt.log.err(err);
	}
}

function* PowerControl (state) {
	if (state) {
		yield* control_socket.sendto('\x01', [ip_addr, 47652]);
	} else {
		yield* control_socket.sendto('\x02', [ip_addr, 47652]);
	}
}

function* PowerMeter (state) {
	// n.b. This query isn't implemented, but proving the port alias concept
	yield* meter_socket.sendto('\x10', [ip_addr, 47652]);
	set('/sensor/power.Power', yield* meter_socket.recieveInt());
}
