/* vim: set noet ts=2 sts=2 sw=2: */

/******************************************************************************/
/******************************************************************************/
/***                                                                        ***/
/***                    ACCESSORS RUNTIME FOR NODE.JS                       ***/
/***                                                                        ***/
/***  This tool can execute an accessor inside of a Node.js (io.js)         ***/
/***  environment.                                                          ***/
/***                                                                        ***/
/******************************************************************************/
/******************************************************************************/

'use strict';

// Make explicit our options. We can then export these to be displayed in higher
// level tools.
var options = {
	'host-server': {
		alias: 'host_server',
		describe: 'URL of the accessor host server to use.',
		type: 'string'
	},
	'debug': {
		describe: 'Turn on debug output.',
		type: 'boolean'
	}
};

try {
	var path_module = require('path');
	var request     = require('request');
	var fs          = require('fs');
	var semver      = require('semver');
	var debug_lib   = require('debug');
	var vm          = require('vm');
	var hashmap     = require('hashmap');

	var argv        = require('yargs')
		.usage('Internal options for the accessors library.')
		.options(options)
		.argv;
} catch (e) {
	console.log("** Missing import in the node runtime");
	console.log("** This is an error with the accessor runtime module.");
	throw e;
}

// Expand the include paths to this folder
process.env.NODE_PATH = __dirname + ':' + __dirname+'/runtime_lib';
require('module').Module._initPaths();

// We use generators which require a newer version of node. We recommend that
// you use io.js as it runs a newer version of the V8 engine and is generally
// just easier to use.
if (!semver.satisfies(process.version, '>=0.11.0')) {
	throw 'Your node version (' + process.version + ') is too old. Need >=0.11. \
Consider using io.js instead of Node.js';
}

// We have info and error level print outs
// To use, run your io.js application like so:
//
//   DEBUG=accessors:* node application.js
//
// or pass --debug as a command line option
//
if (argv.debug) {
	debug_lib.enable('accessors.*');
}
var info = debug_lib('accessors:info');
var error = debug_lib('accessors:error');
var debug = debug_lib('accessors:debug');


var host_server = 'http://accessors.io';
if ('host_server' in argv) {
	host_server = argv.host_server;
	if (host_server.slice(0, 7) != 'http://') {
		host_server = 'http://' + host_server;
	}
}
info('Using host server ' + host_server + ' for accessors.');

var print_functions = {};

/* Update the server to pull accessors from.
 */
function set_host_server (server) {
	host_server = server;
}

/* Return the current server being used to pull accessors from.
 */
function get_host_server () {
	return host_server;
}

function set_output_functions (functions) {
	print_functions = functions;

	if ('debug' in print_functions) {
		debug_lib.log = print_functions.debug;
	}
}

/* Return a list of all accessors
 */
function get_accessor_list (cb) {
	info('art::get_accessor_list');

	var url = host_server + '/list/all';
	request(url, function (err, response, body) {
		if (!err && response.statusCode == 200) {
			cb(null, JSON.parse(body));
		} else {
			error('Could not get list of accessors.')
			error(err)
			if (response) error('Response code: ' + response.statusCode)
			cb('Could not retrieve accessor list from host server');
		}
	})
}

/* Compile an accessor under development without committing. Note this still
 * sends the accessor to a remote server for compilation
 */
function compile_dev_accessor (path, cb) {
	info('art::compile_dev_accessor ' + path);

	var buf = fs.readFileSync(path, 'utf8');
	request({
		method: 'POST',
		uri: host_server + '/dev/upload',
		body: buf
	}, function (err, response, body) {
		info('art::server resp');
		if (!err && response.statusCode == 200) {
			cb(null, response.headers['x-acc-name']);
		} else {
			if (err) error(err);
			if (response) error('Response code: ' + response.statusCode)
			error(body);
			if (response) {
				if (!err) err = response.statusCode;
				cb(err, response.headers['x-acc-name']);
			} else {
				cb(err);
			}
		}
	});
}

function get_test_accessor_ir (path, cb) {
	if (path[0] != '/') path = '/'+path;
	info('art::get_test_accessor_ir from path: ' + path);
	var url = host_server + '/test/accessor' + path + '.json';
	get_accessor_ir_from_url(url, cb);
}

function get_dev_accessor_ir (path, cb) {
	if (path[0] != '/') path = '/'+path;
	info('art::get_dev_accessor_ir from path: ' + path);
	var url = host_server + '/dev/accessor' + path + '.json';
	get_accessor_ir_from_url(url, cb);
}

// Ask for an accessor from the accessor host server and return the
// Accessor Intermediate Representation object.
function get_accessor_ir (path, cb) {
	info('art::get_accessor_ir from path: ' + path);
	var url = host_server + '/accessor' + path + '.json';
	get_accessor_ir_from_url(url, cb);
}

function get_accessor_ir_from_url (url, cb) {
	info('art::gair Retrieving ' + url);
	request(url, function (err, response, body) {
		if (!err && response.statusCode == 200) {
			info('art::gair Successfully got ' + url);
			var accessor = JSON.parse(body);
			cb(null, accessor);
		} else {
			error('Accessor retrieval failed.')
			error(err)
			if (response) error('Response code: ' + response.statusCode)
			cb('Could not retrieve accessor from host server');
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
function create_accessor (path, parameters, cb) {
	info('art::create_accessor from path: ' + path);

	var ir_callback = function (err, accessor) {
		if (err) {
			cb(err);
		} else {
			load_accessor(accessor, parameters, cb);
		}
	};

	if ('/dev' == path.slice(0, 4)) {
		get_dev_accessor_ir(path, ir_callback);
	} else if ('/tests' == path.slice(0, 6)) {
		get_test_accessor_ir(path, ir_callback);
	} else {
		info(">>" + path.slice(0, 6) + "<<");
		get_accessor_ir(path, ir_callback);
	}
}

/*
 * Call this function to make an accessor object out of an accessor
 * intermediate representation block.
 *
 * accessor_ir: JSON blob of the accessor intermediate representation
 * parameters:  object of key:value parameters
 *
 */
function load_accessor (accessor_ir, parameters, cb) {
	info('art::create_accessor starting to create ' + accessor_ir.name);

	if (parameters == undefined) {
		parameters = {};
	}

	// Verify that all required parameters were provided, copy in default values
	for (var i=0; i < accessor_ir.parameters.length; i++) {
		var name = accessor_ir.parameters[i].name;
		if (! (name in parameters) ) {
			if (accessor_ir.parameters[i].required) {
				throw "Missing required parameter " + name;
			} else {
				// Copy in default parameter value
				parameters[name] = accessor_ir.parameters[i].default;
			}
		} else {
			info('Parameter: ' + parameters['name']);
		}
	}

	// Add the parameters to the `eval()` string
	var params = "var parameters = "+JSON.stringify(parameters)+";\n";
	info('art::create_accessor Parameters: ' + params);

	// Need to include the helper functions like get(), get_parameter(), etc
	var runtime_file = path_module.join(__dirname, 'runtime.js');
	var runtime_code = fs.readFileSync(runtime_file);

	// Need an object for the input handlers
	var input_handlers = get_port_handler_arrays(accessor_ir);

	// Export the functions that one can call on this accessor
	var exports = get_exports(accessor_ir);

	// Turn the code into a module
	var module_as_string = params + runtime_code + accessor_ir.code + input_handlers + exports;
	if (typeof module_as_string !== 'string') {
		error("something isn't a string in " + accessor_ir.name);
		throw "This accessor won't work";
	}
	info("art::create_accessor before requireFromString " + accessor_ir.name);

	var device_req = requireFromString(module_as_string);
	var device = new device_req.Accessor();

	// Provide access to the JSON metadata via _meta
	device._meta = accessor_ir;

	// Allow us to set custom functions for console.log, etc
	device._set_output_functions(print_functions);

	info("art::create_accessor before init-ing " + accessor_ir.name);
	cb(null, device);
	// device.init(function (err) {
	// 	info("post-init callback start");
	// 	cb(err, device);
	// });

}

function requireFromString(src) {
	// turns a code string into a loaded module
	var Module = module.constructor;
	var m = new Module();
	m.paths = module.paths;
	m._compile(src);
	return m.exports;
}

// Need to support addInputHandler/addOutputHandler.
//
// Must generate:
//   _port_handlers = {
//       <port_name>: {input: [<func>], output: [<func>]},
//   }
// for all ports.
function get_port_handler_arrays (accessor) {
	var res = "var _port_meta = {init:{}, wrapup:{},";
	var ret = "var _port_handlers = {_fire: [],";
	var reu = "var _port_values = {";
	var rev = "var _port_aliases_to_fq = ";
	var rew = "var _port_fq_to_aliases = ";
	var rex = "var _port_to_bundle = ";
	var rey = "var _bundle_to_ports = ";

	for (var i=0; i<accessor.ports.length; i++) {
		var port = accessor.ports[i];
		var namefq = port.name;

		res += "'" + namefq + "': " + JSON.stringify(port) + ',';
		ret += "'" + namefq + "': {";

		var def = 'null';
		if ('value' in port) {
			def = "'" + port.value + "'";
		}
		reu += "'" + namefq + "': " + def + ",";

		if (port.directions.indexOf('input') > -1) {
			ret += "input: [],"
		}
		if (port.directions.indexOf('output') > -1) {
			ret += "output: [],"
		}
		ret += "},"
	}

	res += '};';
	ret += '};';
	reu += '};';

	// Need a map of all port names to the fully qualified port name
	rev += JSON.stringify(accessor.port_aliases_to_fq) + ';';
	// Need a map of fq port names to all others that may match
	rew += JSON.stringify(accessor.port_fq_to_aliases) + ';';
	// Need a map of fq port names to the bundle they are in
	rex += JSON.stringify(accessor.port_to_bundle) + ';';
	// Need a map of bundle names to the ports in that button
	rey += JSON.stringify(accessor.bundle_to_ports) + ';';

	return res + ret + reu + rev + rew + rex + rey;
}

function get_exports (accessor) {
	// need to keep a list of module exports for toplevel to call
	var export_str = `

module.exports.Accessor = function () {
	_accessor_object = this;
};
util.inherits(module.exports.Accessor, require('events').EventEmitter);

module.exports.Accessor.prototype.init = function (cb) {
  if (typeof init !== "undefined") {
    _do_port_call("init", null, null, cb);
  } else {
    cb();
  }
};

// Write a port to set its value or control the device
module.exports.Accessor.prototype.write = function (port_name, value, cb) {
  _port_values[port_name] = value;
  _do_port_call(port_name, "input", value, cb);
};

// Read a port to get its current value
module.exports.Accessor.prototype.read = function (port_name, cb) {
  _do_port_call(port_name, "output", null, cb);
};

// Cleanup accessor state.
module.exports.Accessor.prototype.wrapup = function (cb) {
  if (typeof wrapup !== "undefined") {
    _do_port_call("wrapup", null, null, cb);
  } else {
    cb();
  }
};

module.exports.Accessor.prototype._set_output_functions = _set_output_functions;
`;

	return export_str;
}

module.exports = {
	set_host_server:      set_host_server,
	get_host_server:      get_host_server,
	set_output_functions: set_output_functions,
	get_accessor_list:    get_accessor_list,
	compile_dev_accessor: compile_dev_accessor,
	get_dev_accessor_ir:  get_dev_accessor_ir,
	create_accessor:      create_accessor,
	load_accessor:        load_accessor,
	get_accessor_ir:      get_accessor_ir,
	options:              options
}
