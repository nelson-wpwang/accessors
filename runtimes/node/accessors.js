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

	//console.log('Using host server ' + host_server + ' for accessors.');

	function create_accessor (path, parameters, success_cb, error_cb) {
		//console.log('art::create_accessor from path: ' + path);

		if (parameters == undefined) {
			parameters = {};
		}
		// Get the accessor file and actually load the object
		var url = host_server + '/accessor' + path + '.json';
		//console.log('Retrieving '  + url);
		request(url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var accessor = JSON.parse(body);

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
				var runtime_web_file = path_module.join(__dirname, 'runtime_web.js');
				var requires = "";
				requires += "var Q = require('q');\n";
				requires += "var request = require('request');\n";
				requires += "var tinycolor = require('tinycolor2');\n";
				requires += "var atob = require('atob');\n";
				requires += "var btoa = require('btoa');\n";
				requires += "var rt = require('"+runtime_web_file+"');\n";

				var ports_str = "var ports = "+JSON.stringify(ports)+";\n";
				//console.log('art::create_accessor Ports string: ' + ports_str);

				var params = "var parameters = "+JSON.stringify(parameters)+";\n";
				//console.log('art::create_accessor Parameters: ' + params);

				var runtime_help_file = path_module.join(__dirname, 'runtime_help.js');
				var runtime_help_code = fs.readFileSync(runtime_help_file);
				runtime_help_code = "rt = require('"+runtime_web_file+"');\n" + runtime_help_code;

				var exports = get_exports(accessor);

				// turn the code into a module
				var module_as_string = requires + ports_str + params + runtime_help_code + accessor.code + exports;
				if (typeof module_as_string !== 'string') {
					//console.log("something isn't a string in " + accessor.name);
					throw "This accessor won't work";
				}
				//console.log("art::create_accessor before requireFromString " + accessor.name);
				var device = requireFromString(module_as_string);

				//console.log('device: ' +device);

				//console.log("art::create_accessor before init-ing " + accessor.name);
				device.init(function () {
					//console.log("post-init callback start");
					success_cb(device);
				}, error_cb);
			} else {
				console.log('Could not get accessor file from host server.');
				if (error) {
					console.log(error);
				}
			}
		});

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
		//export_str += '  rt.log.debug("About to init ' + accessor.name + '");\n';
		export_str += '  _do_port_call(init, null, succ_cb, err_cb);\n';
		export_str += '};\n';

		export_str += 'module.exports.get= get;\n';
		export_str += 'module.exports.set= set;\n';

		return export_str;
	}

	return {
		create_accessor: create_accessor
	}
};

