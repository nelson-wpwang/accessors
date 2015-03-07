/* vim: set noet ts=2 sts=2 sw=2: */

/*** Core Functions ***/
//Not in the namespace

// NOTE: this line is already added by the module creator to resolve the path
// rt = require('./runtime_lib.js');

var Q = require('q');

_do_port_call=function (port, value, done_fn, error_fn) {
	var r;

	rt.log.debug("before port call of " + port + "(" + value + ")");

	try {
		r = port(value);
	} catch (err) {
		// Exception in non-generator port fn
		error_fn();
		return;
	}
	rt.log.debug("after port call, r: " + r);
	if (r && typeof r.next == 'function') {
		var def = Q.async(function* () {
			yield* port(value);
		});
		def().done(done_fn, error_fn);
		rt.log.debug("port call running asynchronously");
	} else {
		done_fn();
	}
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

var AcessorRuntimeException = Error;
