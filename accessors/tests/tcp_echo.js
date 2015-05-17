// name:   TCP Echo
// author: Pat Pannuto
// email:  ppannuto@umich.edu

/* TCP Echo Accessor
 * ======================
 *
 * Writes a string from its `Message` port to a TCP echo server. The server
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

	socket = yield* rt.socket.socket('AF_INET', 'SOCK_STREAM');
	socket.bind(rx_callback);
	yield* socket.connect(['127.0.0.1', 22222]);
}

Message.input = function* (content) {
	yield* socket.send(content);
}

Response.output = function* () {
	return msg;
}

