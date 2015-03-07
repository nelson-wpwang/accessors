/* This runtime conforms to accessor runtime v0.1.0 */
/* vim: set noet ts=2 sts=2 sw=2: */

var Q = require('q');
var request = require('request');
var tinycolor = require('tinycolor2');
var atob = require('atob');
var btoa = require('btoa');
var coap = require('coap');
var urllib = require('url');
// var color = require('color');


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
	rt.log.log("DEBUG: " + message);
}

rt.log.info = function _log_info (message) {
	rt.log.log(" INFO: " + message);
}

rt.log.warn = function _log_warn (message) {
	rt.log.log(" WARN: " + message);
}

rt.log.error = function _log_error (message) {
	rt.log.log("ERROR: " + message);
}

rt.log.critical = function _log_critical (message) {
	rt.log.log(" CRIT: " + message);
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
	setTimeout(fn_to_run, time_in_ms);
}


/*** SOCKETS ***/

rt.socket = Object();

rt.socket.socket = function* (family, sock_type) {
	throw new AccessorRuntimeException("Not implemented");
}


/*** HTTP REQUESTS ***/

rt.http = Object();

rt.http.request = function* request_fn(url, method, properties, body, timeout) {
	rt.log.debug("httpRequest("
				+ (function(obj) {
					result=[];
					for(p in obj) {
						result.push(JSON.stringify(obj[p]));
					};
					return result;
				})(arguments)
				+ ")");

	if (properties != null) {
		throw new AccessorRuntimeException("Don't know what to do with properties...");
	}

	var request_defer = Q.defer();

	var options = {
		url: url,
		method: method,
		body: body,
		timeout: timeout
	}

	rt.log.debug('DOES THIS HAPPEN');

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

	rt.log.debug('before yield in rt.http.request');
	return yield request_defer.promise;
}

//This is just GET. Don't know why it's called readURL...
rt.http.readURL = function* readURL(url) {
	rt.log.debug("runtime_lib::readURL before yield*");
	return yield* rt.http.request(url, 'GET', null, null, 0);
	rt.log.debug("runtime_lib::readURL after yield*");
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
		rt.log.debug("CoAP complete, resp payload: " + resp.payload);
		defer.resolve(resp.payload);
	});
	rt.log.debug("CoAP yielding for I/O operation");
	return yield defer.promise;
}

rt.coap.get = function* coapGet(url) {
	rt.log.debug("CoAP GET: " + url);
	var params = urllib.parse(url);
	params.method = 'GET';
	var ogm = coap.request(params);
	ogm.end();
	yield* _coapCommon(ogm);
}

rt.coap.post = function* coapPost(url, body) {
	rt.log.debug("CoAP POST: " + url + " -- with body:");
	rt.log.debug(body);
	var params = urllib.parse(url);
	params.method = 'POST';
	var ogm = coap.request(params);
	ogm.write(body);
	ogm.end();
	yield* _coapCommon(ogm);
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


exports.version = rt.version;
exports.log = rt.log;
exports.time = rt.time;
exports.socket = rt.socket;
exports.http = rt.http;
exports.coap = rt.coap;
exports.color = rt.color;
exports.encode = rt.encode;
