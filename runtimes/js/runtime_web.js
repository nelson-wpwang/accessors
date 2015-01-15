/* This runtime conforms to accessor runtime v0.1.0 */
/* vim: set noet ts=2 sts=2 sw=2: */

/*** Core Functions ***/
//Not in the namespace

_do_port_call=function  (port, value) {
	rt.log.debug("before port call of " + port + "(" + value + ")");
	var r = port(value);
	rt.log.debug("after port call, r: " + r);
	if (r && typeof r.next == 'function') {
		r = r.next().value;
		rt.log.debug("after port call .next, r: " + r);
		return r;
	}
	return r;
}
module.exports['_do_port_call'] = _do_port_call;



create_port = function() {}; // Apparently don't need to fill this one in
provide_interface = function() {}; // Apparently don't need to fill this one in

get = function (port_name) {
	return ports[port_name];
}

set = function (port_name, val) {
	ports[port_name] = val;
}

get_parameter = function (parameter_name) {
	return parameters[parameter_name];
}

load_dependency = function (path, parameters) {
	if(typeof(parameters)==='undefined') parameters = null;

	throw new AccessorRuntimeException("That was optimistic");
}

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
		json: body,
		timeout: timeout
	}
	var req = request(options, function (error, response, body) {
		if (!error) {
			if (response.statusCode == 200) {
				request_defer.resolve(body);
			} else {
				throw "httpRequest failed with code " + request.statusCode + " at URL: " + url;
			}
		} else {
			throw "httpRequest at URL: " + url + " had an error: \n" + error;
		}
	});

	yield request_defer.promise;
}

//This is just GET. Don't know why it's called readURL...
rt.http.readURL = function* readURL(url) {
	yield* rt.http.request(url, 'GET', null, null, 0);
}

rt.http.post = function* post(url, body) {
	yield* rt.http.request(url, 'POST', null, body, 0);
}

rt.http.put = function* put(url, body) {
	yield* rt.http.request(url, 'PUT', null, body, 0);
}

/*** COLOR FUNCTIONS ***/

// need to npm install tinycolor2 for this. Not tinycolor. Because _javascript_
rt.color = Object();

rt.color.hex_to_hsv = function hex_to_hsv (hex_code) {
	c = tinycolor(hex_code);
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
