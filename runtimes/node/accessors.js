/* vim: set noet ts=2 sts=2 sw=2: */

var path_module = require('path');
var request = require('request');
var fs = require('fs');
var semver = require('semver');

if (!semver.satisfies(process.version, '>=0.11.0')) {
	throw "Your node version (" + process.version + ") is too old. Need >=0.11";
}


module.exports = function (host_server) {
	// Base path to a source of accessor files.
	var host_server = host_server;

	console.log('Using host server ' + host_server + ' for accessors.');

	// Ask for an accessor from the accessor host server and return the
	// Accessor Intermediate Representation object.
	function get_accessor_ir (path, success_cb, error_cb) {
		console.log('art::get_accessor_ir from path: ' + path);

		var url = host_server + '/accessor' + path + '.json';
		console.log('art::gair Retrieving ' + url);

		request(url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var accessor = JSON.parse(body);
				success_cb(accessor);
			} else {
				error_cb('Could not retreive accessor from host server');
			}
		});
	}


	// Call this function to create an object that can be used as an accessor
	//
	// On success you get a callback:
	//     success_cb(device)
	//
	// On failure you get a callback:
	//     error_cb(error_msg)
	//
	function create_accessor (path, parameters, success_cb, error_cb) {
		console.log('art::create_accessor from path: ' + path);

		get_accessor_ir(path, function (accessor) {
			load_accessor(accessor, parameters, success_cb, error_cb);
		}, error_cb);

	}


	// Call this function to make an accessor object out of an accessor
	// intermediate representation block.
	function load_accessor (accessor, parameters, success_cb, error_cb) {
		console.log('art::create_accessor starting to create ' + accessor.name);

		if (parameters == undefined) {
			parameters = {};
		}

		var ports = {};
		for (var i=0; i<accessor.ports.length; i++) {
			var port = accessor.ports[i];
			var value = '';
			if ('default' in port) {
				value = port['default'];
			}
			ports[port.name] = value;
		}

		//XXX: Implement something to figure out the runtime imports neccessary
		//	Some of these are from runtime and some are from Hue
		var runtime_lib_file = path_module.join(__dirname, 'runtime_lib.js');
		var requires = "var rt = require('"+runtime_lib_file+"');\n";

		var ports_str = "var ports = "+JSON.stringify(ports)+";\n";
		console.log('art::create_accessor Ports string: ' + ports_str);

		var params = "var parameters = "+JSON.stringify(parameters)+";\n";
		console.log('art::create_accessor Parameters: ' + params);

		var runtime_file = path_module.join(__dirname, 'runtime.js');
		var runtime_code = fs.readFileSync(runtime_file);

		var exports = get_exports(accessor);

		// turn the code into a module
		var module_as_string = requires + ports_str + params + runtime_code + accessor.code + exports;
		if (typeof module_as_string !== 'string') {
			console.log("something isn't a string in " + accessor.name);
			throw "This accessor won't work";
		}
		console.log("art::create_accessor before requireFromString " + accessor.name);
		var device = requireFromString(module_as_string);

		// Provide access to the JSON metadata via _meta
		device._meta = accessor;

		console.log("art::create_accessor before init-ing " + accessor.name);
		device.init(function () {
			console.log("post-init callback start");
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

	function get_exports (accessor) {
		// need to keep a list of module exports for toplevel to call
		// var export_str = "module.exports = {};\n";
		var export_str = "";

		for (var i=0; i<accessor.ports.length; i++) {
			var port = accessor.ports[i];
			var name = port.name;

			var func = port.function || port.name;

			var wrapper = 'function () {set("'+name+'", arguments[0]); _do_port_call.apply(this, [' + func + ', arguments[0], arguments[1]])};\n'

			export_str += 'module.exports["'+name+'"] = ' + wrapper;
			export_str += 'module.exports["'+func+'"] = ' + wrapper;
		}

		export_str += '\nmodule.exports.init = function (succ_cb, err_cb) {\n';
		export_str += '  rt.log.debug("About to init ' + accessor.name + '");\n';
		export_str += '  _do_port_call(init, null, succ_cb, err_cb);\n';
		export_str += '};\n';

		export_str += 'module.exports.get= get;\n';
		export_str += 'module.exports.set= set;\n';

		return export_str;
	}

	return {
		create_accessor: create_accessor,
		load_accessor: load_accessor,
		get_accessor_ir: get_accessor_ir
	}
};

