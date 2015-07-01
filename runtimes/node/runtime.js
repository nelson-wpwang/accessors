/* vim: set noet ts=2 sts=2 sw=2: */
'use strict';

/*** Core Functions ***/

var lib        = require('lib');

var util       = require('util');
var domain     = require('domain');
// var trycatch   = require('trycatch');
var Q          = require('q');
var debug_lib  = require('debug');

var debug = debug_lib('accessors:debug');
var info  = debug_lib('accessors:info');
var warn  = debug_lib('accessors:warn');
var error = debug_lib('accessors:error');

// We use `_accessor_object` to keep track of `this` for the accessor
// object so we can use the EventEmitter `emit()` function.
var _accessor_object = null;

// Keep track of whether the accessor has been inited()
var _inited = false;

var _remove_from_array = function (item, arr) {
	var to_remove = -1;
	for (var i=0; i<arr.length; i++) {
		if (arr[i] === item) {
			to_remove = i;
			break;
		}
	}
	if (to_remove > -1) {
		arr.splice(to_remove, 1);
	}
}

// Ports can have multiple names based on if they are custom or part of
// an interface. This function accepts any valid name and returns
// the canonical name.
var _get_fq_port_name = function (port_name) {
	if (['init', 'wrapup'].indexOf(port_name) > -1) {
		return port_name;
	}
	return _port_aliases_to_fq[port_name];
}

// Convert port outputs to the correct type
var _force_type = function (val, type) {
	if (type === null) {
		return val;
	} else if (type === 'button') {
		error('Cannot send to a port with type button.');
		return null;
	} else if (type === 'bool') {
		return val == true;
	} else if (type === 'string') {
		return ''+val;
	} else if (type === 'numeric') {
		return Number(val);
	} else if (type === 'integer') {
		return parseInt(val);
	} else if (type === 'select') {
		// TODO: handle this
		return val;
	} else if (type === 'color') {
		// TODO: check this
		return val;
	} else {
		info('Unknown type');
		return val;
	}
}

// Function that wraps calling a port. This sets up all of the promises/futures
// code so that "await" works.
var _do_port_call = function (port_name, direction, value, done_fn) {
	var original_port = port_name;
	port_name = _get_fq_port_name(port_name);

	// Make sure this is a valid port
	if (typeof port_name === 'undefined') {
		var err = 'Port named "' + original_port + '" is invalid.';
		error(err);
		done_fn(err);
		return;
	}

	// Make sure this is a valid direction
	if (port_name !== 'init' && port_name !== 'wrapup') {
		if (!(direction in _port_handlers[port_name])) {
			var err = 'Port "'+port_name+'" is not an '+direction+' port.';
			error(err);
			done_fn(err);
			return;
		}
	}
	var port = _port_meta[port_name];

	// Make sure init() has been called
	if (_inited === false && port_name != 'init') {
		_accessor_object.init(function (err) {
			if (err) {
				error('init failed.');
				done_fn(err);
			} else {
				_do_port_call(port_name, direction, value, done_fn);
			}
		});
		return;
	}

	// in the OUTPUT case, there is no value.
	// in the other cases, there should be a value
	if (direction === 'output' && typeof value === 'function') {
		done_fn = value;
		value = null;
	}

	if (typeof done_fn === 'undefined') {
		done_fn = function () {
			warn("Port call of " + port_name + " finished with no callback");
		}
	}

	info("before port call of " + port_name + "(" + value + ")");

	// If this is an input, we need to save the value that we are writing to
	// the accessor
	if (direction === 'input') {
		_port_values[port_name] = value;
	}

	// Determine which functions to call.
	// These are based on the port handlers that were configured.
	var to_call = [];
	if (port_name === 'init') {
		to_call = [init];
	} else if (port_name === 'wrapup') {
		to_call = [wrapup];
	} else {
		if (direction == 'input') {
			// When writing to a port, we need to find the correct input
			// handler(s) to call. With simple ports, this is easy. With
			// ports that are in a bundle, however, we want to call the most
			// specific handler that is registered. For instance, if we
			// have three ports: X, Y, and Z, and those are in a bundle
			// called Location, and there is a handler for Z and a handler
			// for the bundle, then if X is written to we call the Location
			// bundle handler. But if Z is written to, we call the handler for
			// Z and NOT the bundle handler.
			if (_port_handlers[port_name][direction].length > 0) {
				// Most specific port had handlers, use those
				to_call = _port_handlers[port_name][direction];
			} else {
				// Look for bundles the port is in and see if any of those
				// have handlers. Stop when a handler is found
				var cur_name = port_name;
				while (true) {
					if (cur_name in _port_to_bundle) {
						var bundle = _port_to_bundle[cur_name];
						if (_port_handlers[bundle][direction].length > 0) {
							to_call = _port_handlers[bundle][direction];

							// Now that we are calling a bundle, we need
							// to update the val that we are going to pass
							// to the handler.
							var newval = {};
							for (var i=0; i<_bundle_to_ports[bundle].length; i++) {
								var bundleport = _bundle_to_ports[bundle][i];
								var bundleportval = _port_values[bundleport];
								newval[bundleport] = bundleportval;
								for (var j=0; j<_port_fq_to_aliases[bundleport].length; j++) {
									var bundleportalias = _port_fq_to_aliases[bundleport][j];
									newval[bundleportalias] = bundleportval;
								}
							}
							value = newval;
							info(JSON.stringify(value));

							// This break stops the code from looking for
							// other bundles
							break;

						} else {
							// This bundle has no handlers, keep looking up
							cur_name = bundle;
						}
					} else {
						// No handler and not in bundle, nothing to call
						break;
					}
				}
			}

		} else {
			to_call = _port_handlers[port_name][direction];
		}
	}

	if (to_call.length === 0) {
		// No handlers for this port, just do the callback
		done_fn(null);

	} else {
		// Have work to do

		// Iterate all functions in the port list and call them, checking
		// if they are generators and whatnot.
		info('runtime: to_call length: ' + to_call.length);
		for (var i=0; i<to_call.length; i++) {
			(function (portfn) {

				var d = domain.create();
				var r;

				// This gets called on any error that happens while we are
				// running accessor code.
				d.on('error', function (err) {
					info('Got error in accessor - caught by domain.');

					// Exit the domain. We no longer want it to capture
					// exceptions.
					d.exit();

					// This seems to make things better...
					// I would think that d.exit() would be enough, but
					// somehow, and I don't understand why, the .on('error')
					// still gets called. In particular, the one for
					// .init() gets called. By removing the handlers,
					// exceptions seem to bubble back up to the top.
					d.removeAllListeners('error')

					error('Port err: ' + err);
					done_fn(err);
				});

				d.run(function() {

					// With output, we need to register the given callback before calling the
					// output handling functions. temporary is set to true so that this will
					// only get called once.
					if (direction === 'output') {
						_accessor_object.once(port_name, function (err, val) {
							info('exiting from once ' + port_name)
							d.exit();

							// This seems to make things better...
							d.removeAllListeners('error')

							done_fn(err, val);
						});
					}

					// Common function for after a sync or async function has run
					function finished () {
						info('d.exit ' + port_name)
						d.exit();

						// This seems to make things better...
						d.removeAllListeners('error');

						if (port_name === 'init') {
							_inited = true;
						}

						if (port_name === 'init' || port_name === 'wrapup') {
							done_fn(null);

						} else if (direction === 'input') {
							// We only call the callback when this is an input.
							// If this is an output, when the accessor calls
							// `send()` the done callback will be called.
							done_fn(null);
						}
					}

					r = portfn(value);
					if (r && typeof r.next == 'function') {
						var def = Q.async(function* () {
							r = yield* portfn(value);
						});

						def().done(function () {
							finished();

						}, function (err) {
							error('Exception from async accessor');
							// Throw this error so that the domain can pick it up.
							throw err;
						});
						info("port call running asynchronously");

					} else {
						finished();
					}
				});

			})(to_call[i]);
		}
	}
}

var _set_output_functions = function (functions) {
	if ('console_log' in functions) {
		console.log = functions.console_log;
	}
	if ('console_info' in functions) {
		console.info = functions.console_info;
	}
	if ('console_error' in functions) {
		console.error = functions.console_error;
	}
}

// These function are NOOPs and are only used by the Host Server to understand
// properties of the accessor/device, and do not have any meaning when
// running an accessor.
var createPort = function() {};
var createPortBundle = function() {};
var provideInterface = function() {};
var provide_interface = function() {};

// This allows the accessor to specify a function that should get bound
// to a particular input
var addInputHandler = function (port_name, func) {
	port_name = _get_fq_port_name(port_name);
	if (typeof port_name === 'function') {
		// Using the function in this way defines a new fire() function
		// Check for duplicates
		for (var i=0; i<_port_handlers._fire.length; i++) {
			if (_port_handlers._fire[i] === port_name) {
				error('Adding duplicate fire() function.');
				return null;
			}
		}
		// Add the new fire function before the original fire function
		_port_handlers._fire.unshift(port_name);
		return ['_fire', func];
	}

	if (func === null || func === 'undefined') {
		// Ignore this case.
		return;
	}
	if (typeof func === 'function') {
		if (port_name in _port_handlers) {
			// Check that this hasn't already been added.
			for (var i=0; i<_port_handlers[port_name].input.length; i++) {
				if (func === _port_handlers[port_name].input[i]) {
					error('Already added this handler function.');
					return null;
				}
			}

			_port_handlers[port_name].input.push(func);
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
			if (handle[0] in _port_handlers) {
				_remove_from_array(handle[1], _port_handlers[handle[0]].input);
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


var addOutputHandler = function (port_name, func) {
	port_name = _get_fq_port_name(port_name);
	if (typeof func === 'function') {
		if (port_name in _port_handlers) {
			// Check that this hasn't already been added.
			for (var i=0; i<_port_handlers[port_name].output.length; i++) {
				if (func === _port_handlers[port_name].output[i]) {
					error('Already added this handler function.');
					return null;
				}
			}

			_port_handlers[port_name].output.push(func);
			// Return the name and the function so it can be removed,
			// if desired.
			return [port_name, func];
		} else {
			error('Assigning a new output handler to port_name that does not exist.');
		}
	} else {
		error('Output handler must be a function');
	}
	return null;
}

// This allows an accessor to remove an input callback
var removeOutputHandler = function (handle) {
	if (handle instanceof Array) {
		if (handle.length == 2) {
			if (handle[0] in _port_handlers) {
				_remove_from_array(handle[1], _port_handlers[handle[0]].output);
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
 * comes from the user of the accessor. We do this be returning the last
 * value that was written.
 */
var get = function (port_name) {
	port_name = _get_fq_port_name(port_name);
	return _port_values[port_name];
}

/* `send()` is used by observe ports to forward data to any interested
 * listeners. The runtime maintains the callback list.
 */
var send = function (port_name, val) {
	port_name = _get_fq_port_name(port_name);
	var port = _port_meta[port_name];
	val = _force_type(val, port.type);
	info("SEND: " + port_name + " <= " + val);
	_accessor_object.emit(port_name, null, val);
}

/* `get_parameter()` allows an accessor to retrieve specific parameters
 * from the runtime.
 */
var getParameter = function (parameter_name) {
	return parameters[parameter_name];
}

var load_dependency = function (path, parameters) {
	if (typeof(parameters)==='undefined') parameters = null;
	error('Do not support load_dependency yet.');

	throw new AccessorRuntimeException("That was optimistic");
}
