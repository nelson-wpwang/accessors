/* This runtime conforms to accessor runtime v0.1.0 */
/* vim: set noet ts=2 sts=2 sw=2: */

try {
	var debug        = require('debug');
	var urllib       = require('url');

	var domain       = require('domain');
	var Q            = require('q');
	var request      = require('request');
	var tinycolor    = require('tinycolor2');
	var atob         = require('atob');
	var btoa         = require('btoa');
	var coap         = require('coap');
	var amqp         = require('amqp');
	var dgram        = require('dgram');
	var net          = require('net');
	var socketio_old = require('socket.io-client');
	var through2     = require('through2');
	var WebSocket    = require('ws');
} catch (e) {
	console.log("** Missing import in the node runtime library");
	console.log("** This is an error with the accessor runtime module.");
	throw e;
}


var info  = debug('accessors:info');
var warn  = debug('accessors:warn');
var error = debug('accessors:error');


var AcessorRuntimeException = Error;

/*
 * Create the over-arching runtime object that lets us scope all of this
 * accessor runtime code nicely.
 */

rt = Object();

/*** GENERAL UTILITY ***/

rt.version = function version (set_to) {
	return "0.1.0";
}

rt.log = Object();
rt.log.log = function _log_log (message) {
	console.log(message);
}

rt.log.debug = function _log_debug (message) {
	rt.log.log("ACCESSOR DEBUG: " + message);
}

rt.log.info = function _log_info (message) {
	rt.log.log("ACCESSOR INFO: " + message);
}

rt.log.warn = function _log_warn (message) {
	rt.log.log("ACCESSOR WARN: " + message);
}

rt.log.error = function _log_error (message) {
	rt.log.log("ACCESSOR ERROR: " + message);
}

rt.log.critical = function _log_critical (message) {
	rt.log.log("ACCESSOR CRIT: " + message);
	throw new AccessorRuntimeException(message);
}

rt.time = Object();

rt.time.sleep = function* (time_in_ms) {
	var deferred = Q.defer();
	setTimeout(deferred.resolve, time_in_ms);
	yield deferred.promise;
}

rt.time.run_later = function (time_in_ms, fn_to_run, args) {
	if (args != null) {
		throw new AccessorRuntimeException("runtime doesn't support arguments yet");
	}
	setTimeout(function () {
		var d = domain.create();

		var error_fn = function (err) {
			rt.log.warn("Uncaught exception from an rt.time.run_later'd function");
			console.trace();
			console.log(err);
		}
		d.on('error', error_fn);

		d.run(function() {
			var r = fn_to_run();
			if (r && typeof r.next == 'function') {
				var def = Q.async(function* () {
					r = yield* fn_to_run();
				});
				var finished = function () {
					rt.log.debug("rt.time.run_later callback finished asynchronous run");
				}
				def().done(finished, error_fn);
				rt.log.debug("rt.time.run_later callback running asynchronously");
			}
		});
	}, time_in_ms);
}


/*** SOCKETS ***/

rt.socket = Object();

rt.socket.socket = function* (family, sock_type) {
	var s = Object();

	if (sock_type == 'SOCK_DGRAM') {
		var type;
		var socket;

		if (family == 'AF_INET') type = 'udp4';
		else if (family == 'AF_INET6') type = 'udp6';
		else throw new AccessorRuntimeException("Bad family");

		socket = dgram.createSocket(type, null);

		s.sendto = function* (message, destination) {
			var defer = Q.defer();
			socket.send(message, 0, message.length, destination[1], destination[0],
					function(err) {
						rt.log.debug("rt.<socket::udp>.send done");
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
				console.log("rt.<socket::udp>.on('message'): msg %s from %s:%d",
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
			throw new AccessorRuntimeException("Unhandled tcp socket error");
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
		throw new AccessorRuntimeException("Not implemented");
	}

	return s;
}


/*** HTTP REQUESTS ***/

rt.http = Object();

rt.http.request = function* request_fn(url, method, properties, body, timeout) {
	info("httpRequest("
		+ (function(obj) {
			result=[];
			for(p in obj) {
				result.push(JSON.stringify(obj[p]));
			};
			return result;
		})(arguments)
		+ ")");

	var request_defer = Q.defer();

	var options = {
		url: url,
		method: method,
		headers: properties,
		body: body,
		timeout: timeout
	}

	var req = request(options, function (error, response, body) {
		if (!error) {
			if (response.statusCode == 200) {
				request_defer.resolve(body);
			} else {
				request_defer.reject("httpRequest failed with code " + request.statusCode + " at URL: " + url);
			}
		} else {
			request_defer.reject("httpRequest at URL: " + url + " had an error: \n" + error);
		}
	});

	info('before yield in rt.http.request');
	return yield request_defer.promise;
}

//This is just GET. Don't know why it's called readURL...
rt.http.get = function* get(url) {
	info("runtime_lib::readURL before yield*");
	return yield* rt.http.request(url, 'GET', null, null, 0);
	info("runtime_lib::readURL after yield*");
}

rt.http.post = function* post(url, body) {
	return yield* rt.http.request(url, 'POST', null, body, 0);
}

rt.http.put = function* put(url, body) {
	return yield* rt.http.request(url, 'PUT', null, body, 0);
}

/*** COAP REQUESTS ***/

rt.coap = Object();

function* _coapCommon(ogm) {
	var defer = Q.defer();
	ogm.on('response', function (resp) {
		info("CoAP complete, resp payload: " + resp.payload);
		defer.resolve(resp.payload);
	});
	info("CoAP yielding for I/O operation");
	return yield defer.promise;
}

rt.coap.get = function* coapGet(url) {
	info("CoAP GET: " + url);
	var params = urllib.parse(url);
	params.method = 'GET';
	var ogm = coap.request(params);
	ogm.end();
	yield* _coapCommon(ogm);
}

rt.coap.post = function* coapPost(url, body) {
	info("CoAP POST: " + url + " -- with body:");
	info(body);
	var params = urllib.parse(url);
	params.method = 'POST';
	var ogm = coap.request(params);
	ogm.write(body);
	ogm.end();
	yield* _coapCommon(ogm);
}

rt.coap.observe = function coapObserver(url, callback) {
	info("CoAP OBSERVE: " + url);
	var params = urllib.parse(url);
	params.observe = true;
	var ogm = coap.request(params);
	ogm.on('response', function (resp) {
		resp.pipe(through2(function (chunk, enc, t2callback) {
			info('CoAP obSERve cb');
			callback(chunk.toString('utf-8'));
			t2callback();
		}));
	});
	ogm.end();
}


/*** WEBSOCKET CONNECTIONS ***/

rt.websocket = Object();

rt.websocket.connect = function* websocketConnect (url) {
	var w = Object();

	info('WebSocket Connect: ' + url);
	var defer = Q.defer();
	var ws = new WebSocket(url);
	ws.on('open', function () {
		defer.resolve(w);
	});

	w.subscribe = function (data_callback, error_callback, close_callback) {
		info('WebSocket subscribe.');

		ws.on('message', function (data, flags) {
			data_callback(data);
		});
		if (typeof error_callback === 'function') {
			ws.on('error', error_callback);
		}
		if (typeof close_callback === 'function') {
			ws.on('close', close_callback);
		}
	};

	w.send = function (data) {
		info('WebSocket: sending ' + data);
		ws.send(data);
	};

	return yield defer.promise;
}


/*** RABBITMQ / AMQP CONNECTIONS ***/

rt.amqp = Object();

rt.amqp.connect = function* amqpConnect (url) {
	var a = Object();

	info('AMQP Connect: ' + url);
	var defer = Q.defer();
	var conn = amqp.createConnection({url: url});
	conn.on('ready', function () {
		defer.resolve(a);
	});

	a.subscribe = function (exchange, routing_key, callback) {
		conn.queue('', function (q) {
			q.bind(exchange, routing_key, function () {
				q.subscribe(function (message, headers, deliveryinfo, messageObject) {
					var pkt = JSON.parse(message.data);
					callback(pkt);
				});
			});
		});
	}

	return yield defer.promise;
}

/*** GATDv0.1 ***/

rt.gatd_old = Object();

rt.gatd_old.connect = function* gatdOldConnect (url) {
	var g = Object();
	var conn;

	info('GATD OLD connecting to ' + url);
	var defer = Q.defer();
	var conn = socketio_old.connect(url);
	conn.on('connect', function () {
		info('GATD OLD connected');
		defer.resolve(g);
	});

	g.query = function (query, callback) {
		conn.emit('query', query);
		conn.on('data', callback);
	}

	return yield defer.promise;
}


/*** COLOR FUNCTIONS ***/

// need to npm install tinycolor2 for this. Not tinycolor. Because _javascript_
rt.color = Object();

rt.color.hex_to_hsv = function hex_to_hsv (hex_code) {
	c = tinycolor('#'+hex_code);
	return c.toHsv();
}

rt.color.hsv_to_hex = function hsv_to_hex (hsv) {
	c = tinycolor(hsv);
	return c.toHex();
}

/*** ENCODING FUNCTIONS ***/

rt.encode = Object()

rt.encode.atob = function runtime_atob (b64) {
	return atob(b64);
}

rt.encode.btoa = function runtime_btoa (str) {
	return btoa(str);
}


/*** OTHER / UNDOCUMENTED / WORK-IN-PROGRESS ***/

/*
Functions that accessors can use. Based on a very basic version of
javascript.
*/



/* Parse an HTML document for an element with the given ID, and then return
 * the value of that element. Only works in very simple cases where there
 * not nested elements or crazy spaces.
 */
function getElementValueById (html, id) {
		throw new AccessorRuntimeException("very funny");
}


exports.version   = rt.version;
exports.log       = rt.log;
exports.time      = rt.time;
exports.socket    = rt.socket;
exports.http      = rt.http;
exports.coap      = rt.coap;
exports.websocket = rt.websocket;
exports.amqp      = rt.amqp;
exports.gatd_old  = rt.gatd_old;
exports.color     = rt.color;
exports.encode    = rt.encode;
