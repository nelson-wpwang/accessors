

/* get() and set()
 */

// Populated when accessor is loaded
var accessor_name;
var parameters = {};

function get_parameter (parameter_name) {
	return parameters[parameter_name];
}

function get (field) {
	return $('#'+accessor_name+field).val();
}

function set (field, value) {
	var accessor_input = $('#'+accessor_name+field);

	if (accessor_input.attr('type') == 'checkbox') {
		if (value) {
			accessor_input.prop('checked', true);
		} else {
			accessor_input.prop('checked', false);
		}

	} else if (accessor_input.attr('type') == 'text') {
		accessor_input.val(value);

	} else if (accessor_input.prop('tagName') == 'SELECT') {
		$('#'+accessor_name+field+' option:eq('+value+')').prop('selected', true);

	} else if (accessor_input.prop('tagName') == 'SPAN') {
		accessor_input.text(value);

	}
}






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


/* A basic "socket" class. Provides a socket abstraction so that accessors
   can run in any environment, including those where native sockets aren't
   available (e.g. browsers).
   */

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
