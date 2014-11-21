function init () {
}

function* Lock (lock) {
	if (!lock) return;

	var s = yield* socket.socket('AF_INET6', 'SOCK_DGRAM');
	log.debug("socket value:");
	log.debug(s);
	var host = get_parameter('host');
	var port = get_parameter('port');
	var pass = get_parameter('password');
	s.sendto(pass, [host, port]);
}

function wrapup () {
}

