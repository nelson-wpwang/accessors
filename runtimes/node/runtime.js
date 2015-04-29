/* vim: set noet ts=2 sts=2 sw=2: */

/*** Core Functions ***/
// (Those not in the rt namespace)

// NOTE: this line is already added by the module creator to resolve the path
// rt = require('./runtime_lib.js');

var domain = require('domain');
var Q = require('q');
var AcessorRuntimeException = Error;

_do_port_call=function (port, value, done_fn, error_fn) {
	var r;

	// function sig is (port, done, err) or (port, val, done, err) for get or set
	if (typeof value === 'function') {
		error_fn = done_fn;
		done_fn = value;
	}

	if (typeof done_fn === 'undefined') {
		done_fn = function () {
			rt.log.warn("Port call of " + port + " finished successfully with no callback");
		}
	}
	if (typeof error_fn === 'undefined') {
		error_fn = function () {
			rt.log.warn("Port call of " + port + " had error with no error callback");
		}
	}

	rt.log.debug("before port call of " + port + "(" + value + ")");

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
			rt.log.debug("port call running asynchronously");
		} else {
			done_fn(r);
		}
	});
}
module.exports['_do_port_call'] = _do_port_call;



var create_port = function() {}; // Apparently don't need to fill this one in
var provide_interface = function() {}; // Apparently don't need to fill this one in

var get = function (port_name) {
	console.log("PORT GET: " + port_name + " => " + ports[port_name]);
	return ports[port_name];
}

var set = function (port_name, val) {
	console.log("SET: " + port_name + " <= " + val);
	ports[port_name] = val;
}

var get_parameter = function (parameter_name) {
	return parameters[parameter_name];
}

var load_dependency = function (path, parameters) {
	if(typeof(parameters)==='undefined') parameters = null;

	throw new AccessorRuntimeException("That was optimistic");
}
