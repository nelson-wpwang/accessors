/* author: Pat Pannuto
 * email: ppannuto@umich.edu
 * name: Raspberry Pi Door
 *
 * Accessor for a Door Controller by a Raspberry Pi
 * ================================================
 *
 * We should post the TinyOS app we use for door control to github, so that this
 * description can point to it. File that on the todo list.
 */

function init () {

	// INTERFACES
	provide_interface('/lockunlock/door', {
		'/lock.Lock': Lock
	});

	set_to_locked();
}

function set_to_locked () {
	set('Lock', true);
}

function* Lock (lock) {
	if (lock) return;

	try {
		var s = yield* rt.socket.socket('AF_INET6', 'SOCK_DGRAM');
	} catch (err) {
		rt.log.error("Failed to connect to socket: " + err);
		set_to_locked();
		return;
	}
	var host = get_parameter('host', '::1');
	var port = get_parameter('port', 4999);
	var pass = get_parameter('password', 'password');
	try {
		yield* s.sendto(pass, [host, port]);
	} catch (err) {
		rt.log.error("Failed to send open pacekt: " + err);
		set_to_locked();
		return;
	}
	set('Lock', false);

	rt.time.run_later(2000, set_to_locked);
}
