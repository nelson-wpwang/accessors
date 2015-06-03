/* This runtime conforms to accessor runtime v0.1.0 */
/* vim: set noet ts=2 sts=2 sw=2: */

try {
	var debug_lib    = require('debug');
	var EventEmitter = require('events').EventEmitter;
	var urllib       = require('url');
	var util         = require('util');

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
	var say          = require('say');
	var socketio_old = require('socket.io-client');
	var through2     = require('through2');
	var WebSocket    = require('ws');
} catch (e) {
	console.log("** Missing import in the node runtime library");
	console.log("** This is an error with the accessor runtime module.");
	throw e;
}


var debug = debug_lib('accessors:debug');
var info  = debug_lib('accessors:info');
var warn  = debug_lib('accessors:warn');
var error = debug_lib('accessors:error');


var AcessorRuntimeException = Error;

/* Synchronous / Asynchronous callback helper function.
 *
 * This function is used to call an unknown function pointer and handle
 * it correctly if it is a normal function or a generator. All arguments that
 * should be passed to the fn should be added after the error fn.
 */
function callFn (fn) {
	var sub_arguments = Array.prototype.slice.call(arguments).slice(1);
	var d = domain.create();

	var error_fn = function (err) {
		d.exit();
		rt.log.warn("Uncaught exception from a call");
		console.log(err);
	}
	d.on('error', error_fn);

	d.run(function() {
		var r = fn.apply(this, sub_arguments);
		if (r && typeof r.next === 'function') {
			var def = Q.async(function* () {
				r = yield* fn.apply(this, sub_arguments);
			});
			var finished = function () {
				debug("call finished asynchronous run");
			}
			def().done(finished, function (err) {
				throw err;
			});
			debug("call running asynchronously");
		}
	});
}

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
					debug("rt.time.run_later callback finished asynchronous run");
				}
				def().done(finished, error_fn);
				debug("rt.time.run_later callback running asynchronously");
			}
		});
	}, time_in_ms);
}

/*** Miscellaneous Helper Functions that may be useful in accessors. ***/

rt.helper = Object();

rt.helper.forEach = function (arr, callback) {
	for (var i=0; i<arr.length; i++) {
		callFn(callback, arr[i]);
	}
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

rt.httpClient = Object();

rt.httpClient.requestFinish = function* request_fn(options) {
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

	var req = request(options, function (error, response, body) {
		if (!error) {
			if (response.statusCode == 200) {
				request_defer.resolve({
					body: body,
					statusMessage: response.statusMessage,
					statusCode: response.statusCode
				});
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

rt.httpClient.get = function* get(url) {
	var options = {}

	if (typeof url === 'object') {
		options = url;
	} else {
		options.url = url;
	}
	options.method = 'GET';

	info("runtime_lib::get before yield*");
	return yield* rt.httpClient.requestFinish(options);
	info("runtime_lib::get after yield*");
}

rt.httpClient.post = function* post(url, body) {
	var options = {}

	if (typeof url === 'object') {
		options = url;
	} else {
		options.url = url;
	}
	options.method = 'POST';
	options.body = body;

	return yield* rt.httpClient.requestFinish(options);
}

rt.httpClient.put = function* put(url, body) {
	var options = {}

	if (typeof url === 'object') {
		options = url;
	} else {
		options.url = url;
	}
	options.method = 'PUT';
	options.body = body;

	return yield* rt.httpClient.requestFinish(options);
}

/*** COAP REQUESTS ***/

rt.coap = Object();

function* _coapCommon(ogm) {
	var defer = Q.defer();
	ogm.on('response', function (resp) {
		var content = resp.payload.toString('utf-8')
		info("CoAP complete, resp payload: " + content);
		defer.resolve(content);
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
	return yield* _coapCommon(ogm);
}

rt.coap.post = function* coapPost(url, body) {
	info("CoAP POST: " + url + " -- with body:");
	info(body);
	var params = urllib.parse(url);
	params.method = 'POST';
	var ogm = coap.request(params);
	ogm.write(body);
	ogm.end();
	return yield* _coapCommon(ogm);
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

rt.webSocket = Object();

rt.webSocket.Client = WebSocket;


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


/*** Text to Speech ***/

rt.text_to_speech = Object();

rt.text_to_speech.say = function* text_to_speech_say (text) {
	debug('text_to_speech::say(%s)', text);
	var defer = Q.defer();
	say.speak(null, text, function () {
		defer.resolve();
	});
	return yield defer.promise;
}


/*** BLE ***/

rt.ble = Object();
rt.ble.poweredOn = false;

rt.ble.Central = function* () {

	rt.ble.noble = require('noble');

	if (!rt.ble.poweredOn) {
		info('BLE waiting for powered on');
		var defer = Q.defer();
		rt.ble.noble.on('stateChange', function (state) {
			info('BLE state change: ' + state);
			if (state === 'poweredOn') {
				rt.ble.poweredOn = true;
				defer.resolve(b);
			} else if (state === 'poweredOff') {
				error('BLE appears to be disabled.');
				defer.resolve(null);
			}
		});
	} else {
		return b;
	}

	return yield defer.promise;
}



rt.ble.Central.prototype.scan = function (uuids, callback) {
	info('BLE starting scan');
	rt.ble.noble.on('discover', function (peripheral) {
		callFn(callback, peripheral);
	});

	// Scan for any UUID and allow duplicates.
	rt.ble.noble.startScanning(uuids, true, function (err) {
		if (err) error('BLE: Error when starting scan: ' + err);
	});
};

rt.ble.Central.prototype.scanStop = function () {
	rt.ble.noble.stopScanning();
}

rt.ble.Central.prototype.connect = function* (peripheral, on_disconnect) {
	var connect_defer = Q.defer();
	peripheral.connect(function (err) {
		// Call the disconnect callback properly if the user defined one
		if (typeof on_disconnect === 'function') {
			peripheral.on('disconnect', on_disconnect);
		}
		connect_defer.resolve(err);
	});
	return yield connect_defer.promise;
}

rt.ble.Central.prototype.disconnect = function* (peripheral) {
	var disconnect_defer = Q.defer();
	peripheral.disconnect(function (err) {
		if (err) {
			error('BLE unable to disconnect peripheral.');
			error(err);
			disconnect_defer.resolve(err);
		} else {
			disconnect_defer.resolve(null);
		}
	});
	return yield disconnect_defer.promise;
}

rt.ble.Central.prototype.discoverServices = function* (peripheral, uuids) {
	var ds_defer = Q.defer();
	peripheral.discoverServices(uuids, function (err, services) {
		if (err) {
			error('BLE unable to discover services.');
			error(err);
			ds_defer.resolve(null);
		} else {
			ds_defer.resolve(services);
		}
	});
	return yield ds_defer.promise;
}

rt.ble.Central.prototype.discoverCharacteristics = function* (service, uuids) {
	var dc_defer = Q.defer();
	service.discoverCharacteristics(uuids, function (err, characteristics) {
		if (err) {
			error('BLE unable to discover characteristics.');
			error(err);
			dc_defer.resolve(null);
		} else {
			dc_defer.resolve(characteristics);
		}
	});
	return yield dc_defer.promise;
}

rt.ble.Central.prototype.readCharacteristic = function* (characteristic) {
	var rc_defer = Q.defer();
	characteristic.read(function (err, data) {
		if (err) {
			error('BLE unable to read characteristic.');
			error(err);
			rc_defer.resolve(null);
		} else {
			rc_defer.resolve(Array.prototype.slice.call(data));
		}
	});
	return yield rc_defer.promise;
}

rt.ble.Central.prototype.writeCharacteristic = function* (characteristic, data) {
	var wc_defer = Q.defer();
	characteristic.write(new Buffer(data), false, function (err) {
		if (err) {
			error('BLE unable to write characteristic.');
			error(err);
			wc_defer.resolve(err);
		} else {
			wc_defer.resolve(null);
		}
	});
	return yield wc_defer.promise;
}

rt.ble.Central.prototype.notifyCharacteristic = function (characteristic, notification) {
	characteristic.notify(true, function (err) {
		if (err) {
			error('BLE unable to setup notify for characteristic.');
			error(err);
			return err;
		} else {
			info('setup ble notification callback')
			characteristic.on('data', function (data) {
				callFn(notification, Array.prototype.slice.call(data));
			});
		}
	});
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
exports.helper    = rt.helper;
exports.socket    = rt.socket;
exports.httpClient      = rt.httpClient;
exports.coap      = rt.coap;
exports.webSocket = rt.webSocket;
exports.amqp      = rt.amqp;
exports.gatd_old  = rt.gatd_old;
exports.text_to_speech = rt.text_to_speech;
exports.ble       = rt.ble;
exports.color     = rt.color;
exports.encode    = rt.encode;
