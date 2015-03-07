// name:   UDP Echo
// author: Pat Pannuto
// email:  ppannuto@umich.edu

/* UDP Echo Accessor
 * ======================
 *
 * Writes a string from its `Message` port to a UDP echo server. The server
 * prepends the request number and responds with a delay. The response is
 * captured as an asynchronous event and sets the `Response` output port.
 */

var socket;

function* init () {
	create_port('input', 'Message');
	create_port('output', 'Response');

	socket = yield* rt.socket.socket('AF_INET', 'SOCK_DGRAM');
	socket.bind(rx_callback);
}

function* Message (content) {
	yield* socket.sendto(content, ['localhost', 11111]);
}

function rx_callback(message) {
	set('Response', message);
}
