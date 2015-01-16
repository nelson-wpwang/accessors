/*** Core Functions ***/
//Not in the namespace

rt = require('./runtime_web.js');

_do_port_call=function  (port, value) {
	rt.log.debug("before port call of " + port + "(" + value + ")");
	var r = port(value);
	rt.log.debug("after port call, r: " + r);
	if (r && typeof r.next == 'function') {
		console.log("-----------------------------------------------------");
		var state;
		state = r.next();
		console.log("State first: "); console.log(state);
		while (state.done == false) {
			state = r.next();
			console.log("State next: "); console.log(state);
		}
		console.log("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
		//console.log(r.next());
		//throw "foo";
		//r = r.next().value;
		rt.log.debug("after port call .next, r: " + state.value);
		return state.value;
	}
	return r;
}
module.exports['_do_port_call'] = _do_port_call;



var create_port = function() {}; // Apparently don't need to fill this one in
var provide_interface = function() {}; // Apparently don't need to fill this one in

var get = function (port_name) {
	return ports[port_name];
}

var set = function (port_name, val) {
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
