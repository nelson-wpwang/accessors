/* vim: set noet ts=2 sts=2 sw=2: */
'use strict';

/*** Core Functions ***/
// (Those not in the rt namespace)


var domain     = require('domain');
var Q          = require('q');
var debug_lib  = require('debug');

var debug = debug_lib('accessors:debug');
var info = debug_lib('accessors:info');
var warn = debug_lib('accessors:warn');
var error = debug_lib('accessors:error');

var AcessorRuntimeException = Error;

// Keep track of callbacks on observe ports. Also keep track of error callbacks,
// so if the listener gets booted we can alert the error callback.
var _observe_listeners = {};

// Function that wraps calling a port. This sets up all of the promises/futures
// code so that "await" works.
var _do_port_call = function (port, port_name, direction, value, done_fn, error_fn) {
	var r;

	// in the OUTPUT case, there is no value.
	// in the other cases, there should be a value
	if (direction == 'output' && typeof value === 'function') {
		error_fn = done_fn;
		done_fn = value;
	}

	if (typeof done_fn === 'undefined') {
		done_fn = function () {
			warn("Port call of " + port_name + " finished successfully with no callback");
		}
	}
	if (typeof error_fn === 'undefined') {
		error_fn = function (err) {
			warn("Port call of " + port_name + " had error with no error callback");
			debug(err);
		}
	}

	info("before port call of " + port_name + "(" + value + ")");

	// Need to handle observe specially.
	// With observe, value is a callback that we have to remember.
	if (direction == 'observe' && typeof value === 'function') {
		info('Adding observe callback for ' + port_name);
		if (!(port_name in _observe_listeners)) {
			_observe_listeners[port_name] = {
				data_callbacks: [],
				error_callbacks: []
			};
		}
		// Check that this callback hasn't already been registered
		var already_added = false;
		for (var i=0; i<_observe_listeners[port_name].data_callbacks.length; i++) {
			if (_observe_listeners[port_name].data_callbacks[i] == value) {
				info('Function for port ' + port_name + ' already added.');
				already_added = true;
				break;
			}
		}
		if (!already_added) {
			// Add the callback to the listener list
			_observe_listeners[port_name].data_callbacks.push(value);
			_observe_listeners[port_name].error_callbacks.push(error_fn);
		}

		// Now we only need to call the actual accessor if we haven't set
		// up an observe callback before.
		if (_observe_listeners[port_name].data_callbacks.length > 1) {
			done_fn();
			return;
		} else {
			// If this is the first listener we need to call the accessor
			// with `true` so that it sets up the callback
			value = true;
		}
	}

	// Determine which functions to call.
	// By default, just call the port function.
	var to_call = [port];
	if (direction === 'input') {
		// If this is an input, however, call all functions that have been
		// configured as handlers (dynamically or upon creation).
		to_call = _input_handlers[port_name];
	}

	var d = domain.create();

	d.on('error', function (err) {
		d.exit();

		// If an error occurred while setting up the observe, remove the
		// registered callbacks
		if (direction === 'observe') {
			_observe_listeners[port_name].data_callbacks = [];
			_observe_listeners[port_name].error_callbacks = [];
		}

		error_fn(err);
	});

	d.run(function() {
		// Iterate all functions in the port list and call them, checking
		// if they are generators and whatnot.
		for (var i=0; i<to_call.length; i++) {
			(function (port) {
				r = port(value);
				if (r && typeof r.next == 'function') {
					var def = Q.async(function* () {
						r = yield* port(value);
					});

					def().done(function () {
						done_fn(r);

					}, function (err) {
						// Throw this error so that the domain can pick it up.
						throw err;
					});
					info("port call running asynchronously");

				} else {
					done_fn(r);
				}
			})(to_call[i]);
		}
	});
}

// These function are NOOPs and are only used by the Host Server to understand
// properties of the accessor/device, and do not have any meaning when
// running an accessor.
var createPort = function() {};
var provideInterface = function() {};

// This allows the accessor to specify a function that should get bound
// to a particular input
var addInputHandler = function (port_name, func) {
	if (typeof port_name === 'function') {
		// Using the function in this way defines a new fire() function
		// Check for duplicates
		for (var i=0; i<_input_handlers._fire.length; i++) {
			if (_input_handlers._fire[i] === port_name) {
				error('Adding duplicate fire() function.');
				return null;
			}
		}
		// Add the new fire function before the original fire function
		_input_handlers._fire.unshift(port_name);
		return ['_fire', func];
	}



	if (func === null || func === 'undefined') {
		// Ignore this case.
		return;
	}
	if (typeof func === 'function') {
		if (port_name in _input_handlers) {
			// Check that this hasn't already been added.
			for (var i=0; i<_input_handlers[port_name].length; i++) {
				if (func === _input_handlers[port_name][i]) {
					error('Already added this handler function.');
					return null;
				}
			}

			_input_handlers[port_name].push(func);
			// Return the name and the function so it can be removed,
			// if desired.
			return [port_name, func];
		} else {
			error('Assigning a new input handler to port_name that does not exist.');
		}
	} else {
		error('Input handler must be a function');
	}
	return null;
}

// This allows an accessor to remove an input callback
var removeInputHandler = function (handle) {
	if (handle instanceof Array) {
		if (handle.length == 2) {
			if (handle[0] in _input_handlers) {
				var to_remove = -1;
				// Iterate through the callbacks looking for
				for (var i=0; i<_input_handlers[handle[0]].length; i++) {
					var handler = _input_handlers[handle[0]][i];
					if (handler === handle[1]) {
						to_remove = i;
						break;
					}
				}
				if (to_remove > -1) {
					// Actually remove it from the array
					_input_handlers[handle[0]].splice(to_remove, 1);
				}
			} else {
				error('Remove handle for non-existent port.');
			}
		} else {
			error('Bad handle, wrong length.');
		}
	} else {
		error('Bad handle, not array.')
	}
}



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

		// In case a callback fails, we want to remove it
		var listeners_to_remove = [];

		for (var i=0; i<_observe_listeners[port_name].data_callbacks.length; i++) {
			try {
				_observe_listeners[port_name].data_callbacks[i](val);
			} catch (err) {
				warn('Removing observe listener ' + i + ' due to exception.');
				listeners_to_remove.push(i);
			}
		}

		// Remove broken listeners
		while (listeners_to_remove.length) {
			var to_remove = listeners_to_remove.pop();
			_observe_listeners[port_name].data_callbacks.splice(to_remove, 1);
			_observe_listeners[port_name].error_callbacks[to_remove]('Removed');
			_observe_listeners[port_name].error_callbacks.splice(to_remove, 1);
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
