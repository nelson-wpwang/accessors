var dgram     = require('dgram');
var debug_lib = require('debug');
var net       = require('net');
var Q         = require('q');

var debug = debug_lib('accessors:socket:debug');
var info  = debug_lib('accessors:socket:info');
var warn  = debug_lib('accessors:socket:warn');
var error = debug_lib('accessors:socket:error');


module.exports.socket = function* (family, sock_type) {
	var s = Object();

	if (sock_type == 'SOCK_DGRAM') {
		var type;
		var socket;

		if (family == 'AF_INET') type = 'udp4';
		else if (family == 'AF_INET6') type = 'udp6';
		else throw new Error("Bad family");

		socket = dgram.createSocket(type, null);

		s.sendto = function* (message, destination) {
			var defer = Q.defer();
			socket.send(message, 0, message.length, destination[1], destination[0],
					function(err) {
						debug("rt.<socket::udp>.send done");
						if (err == 0) {
							defer.resolve();
						} else {
							defer.reject(err);
						}
					});
			return yield defer.promise;
		}

		s.bind = function (cb) {
			socket.bind();

			socket.on('message', function(msg, rinfo) {
				debug("rt.<socket::udp>.on('message'): msg %s from %s:%d",
						msg, rinfo.address, rinfo.port);
				cb(msg);
			});
		}
	} else if (sock_type == 'SOCK_STREAM') {
		var socket;

		socket = new net.Socket();

		socket.on('error', function(err) {
			console.log("rt.<socket::tcp>.on('error') [\\n]:");
			console.log(err);
			throw new Error("Unhandled tcp socket error");
		});

		s.connect = function* (destination) {
			var defer = Q.defer();
			socket.connect(destination[1], destination[0],
					function connect_succ() {
						defer.resolve();
					});
			return yield defer.promise;
		}

		s.bind = function (cb) {
			socket.on('data', cb);
		}

		s.send = function* (message) {
			var defer = Q.defer();
			socket.write(message, 'utf8',
					function write_done() {
						defer.resolve();
					});
			return yield defer.promise;
		}

	} else {
		throw new Error("Not implemented");
	}

	return s;
}
