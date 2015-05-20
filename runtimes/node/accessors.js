/* vim: set noet ts=2 sts=2 sw=2: */

try {
	var path_module = require('path');
	var request     = require('request');
	var fs          = require('fs');
	var semver      = require('semver');
	var debug       = require('debug');
	var vm          = require('vm');
	var hashmap     = require('hashmap');
} catch (e) {
	console.log("** Missing import in the node runtime");
	console.log("** This is an error with the accessor runtime module.");
	throw e;
}

// We use generators which require a newer version of node. We recommend that
// you use io.js as it runs a newer version of the V8 engine and is generally
// just easier to use.
if (!semver.satisfies(process.version, '>=0.11.0')) {
	throw "Your node version (" + process.version + ") is too old. Need >=0.11";
}

// We have info and error level print outs
// To use, run your io.js application like so:
//
//   DEBUG=accessors:* node application.js
//
var info = debug('accessors:info');
var error = debug('accessors:error');

// module.exports = function (host_server) {
// Base path to a source of accessor files.
var host_server = 'http://accessors.io';
info('Using host server ' + host_server + ' for accessors.');

/* Update the server to pull accessors from.
 */
function set_host_server (server) {
	host_server = server;
}

/* Return a list of all accessors
 */
function get_accessor_list (success_cb, error_cb) {
	info('art::get_accessor_list');

	var url = host_server + '/list/all';
	request(url, function (err, response, body) {
		if (!err && response.statusCode == 200) {
			success_cb(JSON.parse(body));
		} else {
			error('Could not get list of accessors.')
			error(err)
			error('Response code: ' + response.statusCode)
			error_cb('Could not retrieve accessor list from host server');
		}
	})
}

// Ask for an accessor from the accessor host server and return the
// Accessor Intermediate Representation object.
function get_accessor_ir (path, success_cb, error_cb) {
	info('art::get_accessor_ir from path: ' + path);
	var url = host_server + '/accessor' + path + '.json';

	info('art::gair Retrieving ' + url);
	request(url, function (err, response, body) {
		if (!err && response.statusCode == 200) {
			var accessor = JSON.parse(body);
			success_cb(accessor);
		} else {
			error('Accessor retrieval failed.')
			error(err)
			error('Response code: ' + response.statusCode)
			error_cb('Could not retrieve accessor from host server');
		}
	});
}


/*
 * Call this function to create an object that can be used as an accessor.
 *
 * path:       /path/to/accessor
 * parameters: object of key:value parameters
 *
 * On success you get a callback:
 *     success_cb(device)
 *
 * On failure you get a callback:
 *     error_cb(error_msg)
 *
 */
function create_accessor (path, parameters, success_cb, error_cb) {
	info('art::create_accessor from path: ' + path);

	get_accessor_ir(path, function (accessor) {
		load_accessor(accessor, parameters, success_cb, error_cb);
	}, error_cb);

}

/*
 * Call this function to make an accessor object out of an accessor
 * intermediate representation block.
 *
 * accessor_ir: JSON blob of the accessor intermediate representation
 * parameters:  object of key:value parameters
 *
 */
function load_accessor (accessor_ir, parameters, success_cb, error_cb) {
	info('art::create_accessor starting to create ' + accessor_ir.name);

	if (parameters == undefined) {
		parameters = {};
	}

	//XXX: Implement something to figure out the runtime imports neccessary
	var runtime_lib_file = path_module.join(__dirname, 'runtime_lib.js');
	var requires = "var rt = require('"+runtime_lib_file+"');\n";

	// Add the parameters to the `eval()` string
	var params = "var parameters = "+JSON.stringify(parameters)+";\n";
	info('art::create_accessor Parameters: ' + params);

	// Need to include the helper functions like get(), get_parameter(), etc
	var runtime_file = path_module.join(__dirname, 'runtime.js');
	var runtime_code = fs.readFileSync(runtime_file);

	// Need objects for our port function scheme (e.g. Power.input)
	var port_objs = get_port_objects(accessor_ir);

	// Export the functions that one can call on this accessor
	var exports = get_exports(accessor_ir);

	// Turn the code into a module
	var module_as_string = requires + port_objs + params + runtime_code + accessor_ir.code + exports;
	if (typeof module_as_string !== 'string') {
		error("something isn't a string in " + accessor_ir.name);
		throw "This accessor won't work";
	}
	info("art::create_accessor before requireFromString " + accessor_ir.name);

	var device = requireFromString(module_as_string);

	// Provide access to the JSON metadata via _meta
	device._meta = accessor_ir;

	info("art::create_accessor before init-ing " + accessor_ir.name);
	device.init(function () {
		info("post-init callback start");
		success_cb(device);
	}, error_cb);

}

function requireFromString(src) {
	// turns a code string into a loaded module
	var Module = module.constructor;
	var m = new Module();
	m.paths = module.paths;
	m._compile(src);
	return m.exports;
}

// Accessors specify port functions as
//
//    PortName.input = function* () {...}
//
// We need `PortName` to exist.
function get_port_objects (accessor) {
	var port_obj_created = new hashmap.HashMap();
	var port_obj_str = '';

	for (var i=0; i<accessor.ports.length; i++) {
		var port = accessor.ports[i];
		var temp = port.function.split('.');
		var name = temp.shift();

		if (temp.length == 0) {
			// This is a created port
			port_obj_str += 'var ' + name + ' = {};';
			continue
		}

		var dovar = !port_obj_created.has(name);
		var extra = ''
		while (temp.length) {
			if (!port_obj_created.has(name)) {
				extra += name + ' = {};';
				port_obj_created.set(name, '');
			}
			name += '.' + temp.shift();
		}
		if (dovar) {
			port_obj_str += 'var ' + extra + name + ' = {};';
		} else {
			port_obj_str += extra + name + ' = {};';
		}
	}

	return port_obj_str;
}

function get_exports (accessor) {
	// need to keep a list of module exports for toplevel to call
	var export_str = "module.exports = {};\n";

	// Need to add functions for each port of the accessor to the exports
	// listing
	for (var i=0; i<accessor.ports.length; i++) {
		var port = accessor.ports[i];
		var name = port.name;
		var func = port.function;
		var export_name = func.replace(/\./g, '_');

		export_str += 'module.exports.'+export_name+' = {};\n';

		// Each port can support multiple directions based on what makes
		// sense for the particular device
		for (var j=0; j<port.directions.length; j++) {
			var direction = port.directions[j];
			export_str += 'module.exports.'+export_name + '.' + direction + ' = function () {_do_port_call.apply(this, ['+func+'.'+direction+',"'+name+'","'+direction+'",arguments[0],arguments[1],arguments[2]])};\n'
		}
	}

	export_str += '\nmodule.exports.init = function (succ_cb, err_cb) {\n';
	export_str += '  _do_port_call(init, "init", null, null, succ_cb, err_cb);\n';
	export_str += '};\n';

	return export_str;
}

module.exports= {
	set_host_server: set_host_server,
	get_accessor_list: get_accessor_list,
	create_accessor: create_accessor,
	load_accessor: load_accessor,
	get_accessor_ir: get_accessor_ir
}
