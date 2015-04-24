/* vim: set noet ts=2 sts=2 sw=2: */

/*** Core Functions ***/
// (Those not in the rt namespace)


var domain = require('domain');
var Q      = require('q');
var debug  = require('debug');

var info = debug('accessors:info');
var warn = debug('accessors:warn');
var error = debug('accessors:error');

var AcessorRuntimeException = Error;

// Keep track of callbacks on observe ports.
var _observe_listeners = {};

// Function that wraps calling a port. This sets up all of the promises/futures
// code so that "await" works.
_do_port_call=function (port, direction, value, done_fn, error_fn) {
	var r;

	// in the OUTPUT case, there is no value.
	// in the other cases, there should be a value
	if (direction == 'output' && typeof value === 'function') {
		error_fn = done_fn;
		done_fn = value;
	}

	if (typeof done_fn === 'undefined') {
		done_fn = function () {
			warn("Port call of " + port + " finished successfully with no callback");
		}
	}
	if (typeof error_fn === 'undefined') {
		error_fn = function () {
			warn("Port call of " + port + " had error with no error callback");
		}
	}

	info("before port call of " + port + "(" + value + ")");

	// Need to handle observe specially.
	// With observe, value is a callback that we have to remember.
	if (direction == 'observe' && typeof value === 'function') {
		if (!(port in _observe_listeners)) {
			_observe_listeners[port] = [];
		}
		// Check that this callback hasn't already been registered
		var already_added = false;
		for (var i=0; i<_observe_listeners.length; i++) {
			if (_observe_listeners[i] == value) {
				already_added = true;
				break;
			}
		}
		if (!already_added) {
			// Add the callback to the listener list
			_observe_listeners.push(value);
		}

		// Now we only need to call the actual accessor if we haven't set
		// up an observe callback before.
		if (_observe_listeners.length > 1) {
			done_fn();
			return;
		} else {
			// If this is the first listener we need to call the accessor
			// with `true` so that it sets up the callback
			value = true;
		}
	}

	var d = domain.create();

	d.on('error', error_fn);

	d.run(function() {
		r = port(value);
		if (r && typeof r.next == 'function') {
			var def = Q.async(function* () {
				r = yield* port(value);
			});
			finished = function () {
				done_fn(r);
			}
			def().done(finished, error_fn);
			info("port call running asynchronously");
		} else {
			done_fn(r);
		}
	});
}
module.exports['_do_port_call'] = _do_port_call;


// These function are NOOPs and are only used by the Host Server to understand
// properties of the accessor/device, and do not have any meaning when
// running an accessor.
var create_port = function() {};
var provide_interface = function() {};

/* `get()` allows an accessor to read the input on one of its ports that
 * comes from the user of the accessor. Currently, the node.js runtime is
 * exclusively dataflow, meaning calling `get()` has no effect as there is
 * no conceptual method to read the value of an input as it only exists
 * as an impluse, and not as a state.
 *
 * Therefore we just return null
 */
var get = function (port_name) {
	info("PORT GET: " + port_name + " => NOT SUPPORTED");
	return null;
}

/* `send()` is used by observe ports to forward data to any interested
 * listeners. The runtime maintains the callback list.
 */
var send = function (port_name, val) {
	info("SEND: " + port_name + " <= " + val);

	if (port_name in _observe_listeners) {
		for (var i=0; i<_observe_listeners.length; i++) {
			_observe_listeners[i](val);
		}
	}
}

/* `get_parameter()` allows an accessor to retrieve specific parameters
 * from the runtime.
 */
var get_parameter = function (parameter_name) {
	return parameters[parameter_name];
}

var load_dependency = function (path, parameters) {
	if (typeof(parameters)==='undefined') parameters = null;
	error('Do not support load_dependency yet.');

	throw new AccessorRuntimeException("That was optimistic");
}
