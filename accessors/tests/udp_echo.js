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
var msg;

function rx_callback(message) {
	msg = message;
}

function* init () {
	create_port('Message');
	create_port('Response');

	socket = yield* rt.socket.socket('AF_INET', 'SOCK_DGRAM');
	socket.bind(rx_callback);
}

Message.input = function* (content) {
	yield* socket.sendto(content, ['localhost', 11111]);
}

Response.output = function* () {
	return msg;
}
