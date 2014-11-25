/* This runtime conforms to accessor runtime v0.1.0 */
/* vim: set noet ts=2 sts=2 sw=2: */

/*** GENERAL UTILITY ***/

function version(set_to) {
	return "0.1.0";
}

log = Object();
log.log = function _log_log (message) {
	console.log(message);
}

log.debug = function _log_debug (message) {
	log.log("DEBUG: " + message);
}

log.info = function _log_info (message) {
	log.log(" INFO: " + message);
}

log.warn = function _log_warn (message) {
	log.log(" WARN: " + message);
}

log.error = function _log_error (message) {
	log.log("ERROR: " + message);
}

log.critical = function _log_critical (message) {
	log.log(" CRIT: " + message);
	throw new AccessorRuntimeException(message);
}


time = Object();
time.sleep = function* (time_in_ms) {
	var deferred = Q.defer();
	setTimeout(deferred.resolve, time_in_ms);
	yield deferred.promise;
}
time.run_later = function (time_in_ms, fn_to_run, args) {
	if (args != null) {
		throw new AccessorRuntimeException("runtime doesn't support arguments yet");
	}
	setTimeout(fn_to_run, time_in_ms);
}


/*** ACCESSOR INTERFACE AND PROPERTIES ***/
// get(), set(), and get_parameter() are in the accessor and created
// by the webserver.


/*** SOCKETS ***/

socket = Object();

socket.socket = function* (family, sock_type) {
	var s = new Object();

	if (typeof ws_server_address == 'undefined') {
		log.critical("No websocket server. Socket facilities unavailable");
	}

	// Make a connection back to the socket tunneling server (ws_server)
	var ws = new WebSocket(ws_server_address);
	var ws_defer = Q.defer();

	ws.onopen = function (evt) {
		console.log("ws connected");
		ws_defer.resolve(ws);
	}
	ws.onclose = function (evt) {
		console.log("ws onclose");
		ws_defer.reject(new Error(evt));
	}
	ws.onmessage = function (evt) {
		console.log("ws message");
	}
	ws.onerror = function (evt) {
		// TODO On connect failure we get this and an onclose, should really only
		// reject the promise once.
		console.log("ws onerror");
		ws_defer.reject(new Error(evt));
	}

	console.log('before yield');
	s.ws = yield ws_defer.promise;
	console.log('s.ws:');
	console.log(s.ws);

	var msg = {
		type: 'handshake',
		version: 0.1,
		family: family,
		sock_type: sock_type
	};
	s.ws.send(JSON.stringify(msg));

	s.sendto = function (bytes, dest) {
		var msg = {
			type: 'udp',
			bytes: bytes,
			dest: dest
		};
		s.ws.send(JSON.stringify(msg));
	};
	return s;
}


/*** HTTP REQUESTS ***/

http = Object();

http.request = function* request(url, method, properties, body, timeout) {
	log.debug("httpRequest("
				+ (function(obj) {
					result=[];
					for(p in obj) {
						result.push(JSON.stringify(obj[p]));
					};
					return result;
				})(arguments)
				+ ")");

	var request_defer = Q.defer();
	var request = new XMLHttpRequest();

	request.onload = function request_listener () {
		request_defer.resolve();
	}

	request.open(method, "/proxy?method="+method+"&url="+btoa(url));
	request.send(body);

	yield request_defer.promise;

	if (request.readyState === request.DONE) {
		if (request.status == 200) {
			return request.responseText;
		} else {
			throw "httpRequest failed with code " + request.status + " at URL: " + url;
		}
	} else {
		throw "httpRequest did not complete: " + url;
	}
}

http.readURL = function* readURL(url) {
	log.debug("readURL(" + url + ")");

	var request_defer = Q.defer();
	var request = new XMLHttpRequest();

	request.onload = function readURL_listener () {
		request_defer.resolve();
	}

	request.open("GET", "/proxy?method=get&url="+btoa(url));
	// Null argument says there is no body.
	request.send(null);

	yield request_defer.promise;

	if (request.readyState === request.DONE) {
		if (request.status == 200) {
			return request.responseText;
		} else {
			throw "readURL failed with code " + request.status + " at URL: " + url;
		}
	} else {
		throw "readURL did not complete: " + url;
	}
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
	var start_index = 0;
	var id_index = 0;

	while (true) {
		id_index = html.indexOf(id, start_index);

		if ((id_index - start_index) < 4) {
			// If -1, then it wasn't found. If < 4, there isn't room for
			// the 'id="' part.
			return null;
		}
		var part_check = html.substring(id_index, id_index-4);
		if (part_check == 'id="') {
			// At this point we're going to say we found the correct element.
			break;
		} else {
			// Must've been something else. Keep searching.
			start_index = id_index;
		}
	}

	// Find the next ">" marking the end of the element identifier and
	// start of the value.
	var val_index_beg = html.indexOf(">", id_index) + 1;
	var val_index_end = html.indexOf("<", val_index_beg);

	return html.substring(val_index_beg, val_index_end);
}

function getXMLValue (xml, element) {
	var first = xml.indexOf(element);
	var second = xml.indexOf(element, first+1);
	return xml.substring(first+element.length+1, second-2);
}
