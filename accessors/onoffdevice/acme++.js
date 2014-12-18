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
	ip_addr = get_parameter('ipv6_address');
}

function* Power (state) {
	try {
		var s = yield* rt.socket.socket('AF_INET6', 'SOCK_DGRAM');
	} catch (err) {
		rt.log.err(err);
	}

	if (state) {
		yield* s.sendto('\x01', [ip_addr, 47652]);
	} else {
		yield* s.sendto('\x02', [ip_addr, 47652]);
	}
}