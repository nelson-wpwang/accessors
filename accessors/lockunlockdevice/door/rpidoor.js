function init () {
	set_to_locked();
}

function set_to_locked () {
	set('Lock', true);
}

function* Lock (lock) {
	if (lock) return;

	try {
		var s = yield* socket.socket('AF_INET6', 'SOCK_DGRAM');
	} catch (err) {
		log.error("Failed to connect to socket: " + err);
		set_to_locked();
		return;
	}
	var host = get_parameter('host');
	var port = get_parameter('port');
	var pass = get_parameter('password');
	try {
		yield* s.sendto(pass, [host, port]);
	} catch (err) {
		log.error("Failed to send open pacekt: " + err);
		set_to_locked();
		return;
	}
	set('Lock', false);

	time.run_later(2000, set_to_locked);
}

function wrapup () {
}

