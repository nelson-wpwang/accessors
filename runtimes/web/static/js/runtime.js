/* This runtime conforms to accessor runtime v0.1.0 */

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
}


/*** ACCESSOR INTERFACE AND PROPERTIES ***/
// get(), set(), and get_parameter() are in the accessor and created
// by the webserver.


/*** SOCKETS ***/

socket = Object();

socket.socket = function* (family, sock_type) {
	var s = new Object();

	// Make a connection back to the socket tunneling server (ws_server)
	// TODO: This should probably be a configurable parameter
	var ws = new WebSocket("ws://patbook.eecs.umich.edu:8765");
	var ws_defer = Q.defer();

	ws.onopen = function (evt) {
		console.log("ws connected");
		ws_defer.resolve(ws);
	}
	ws.onclose = function (evt) {
		console.log("ws onclose");
		console.log("TODO: Do something about this");
	}
	ws.onmessage = function (evt) {
		console.log("ws message");
	}
	ws.onerror = function (evt) {
		console.log("ws onerror");
		console.log("TODO: Do something about this");
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
