var path_module = require('path');
var request = require('request');
var fs = require('fs');
var semver = require('semver');

if (!semver.satisfies(process.version, '>=0.11.0')) {
	throw "Your node version (" + process.version + ") is too old. Need >=0.11";
}

//XXX: Should include actual dependencies somehow and only push these into the module

// var json_data = '';

/*
//XXX This can be used again when Pat gets the accessor accessor working
http.get("http://pfet-v2.eecs.umich.edu:6565/accessor/onoffdevice/light/hue/huesingle.json", function(res) {
console.log("Got response:\n" + res.statusCode);
var body = '';

res.on('data', function(chunk) {
body += chunk;
});

res.on('end', function() {
json_data = JSON.parse(body);
});
}).on('error', function(e) {
console.log("Got error: " + e.message);
});
*/

// --- for testing offline ---
// var json_str = fs.readFileSync('huesingle.json', 'utf8');
//var json_str = fs.readFileSync('test.json', 'utf8');
// ---------------------------

// var hue = create_accessor(JSON.parse(json_str));
// var promise = hue.init().next().value;
// promise.then(function(){promise = hue.get_buld_id().next().value;});

function create_accessor (path, parameters, success_cb, error_cb) {
	console.log('art::create_accessor from path: ' + path);

	if (parameters == undefined) {
		parameters = {};
	}
	request('http://localhost:6565/accessor'+path+'.json', function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var accessor = JSON.parse(body);
				// console.log(accessor)

				var ports = {};
				for (var i=0; i<accessor.ports.length; i++) {
					ports[accessor.ports[i].name] = '';
				}
				// console.log(ports);

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

				//XXX: autogenerate these
				//	Also figure out what their default values should be
				var ports_str = "var ports = "+JSON.stringify(ports)+";\n";
				console.log('art::create_accessor Ports string: ' + ports_str);

				//XXX: autogenerate these
				//	Also figure out what their default values should be
				var params = "var parameters = "+JSON.stringify(parameters)+";\n";
				console.log('art::create_accessor Parameters: ' + params);

				var runtime_help_file = path_module.join(__dirname, 'runtime_help.js');
				var runtime_help_code = fs.readFileSync(runtime_help_file);
				runtime_help_code = "rt = require('"+runtime_web_file+"');\n" + runtime_help_code;

				var exports = get_exports(accessor);

				// turn the code into a module
				var module_as_string = requires + ports_str + params + runtime_help_code + accessor.code + exports;
				if (typeof module_as_string !== 'string') {
					console.log("something isn't a string in " + accessor.name);
					throw "This accessor won't work";
				}
				console.log("art::create_accessor before requireFromString " + accessor.name);
				var device = requireFromString(module_as_string);

				console.log(device);

				console.log("art::create_accessor before init-ing " + accessor.name);
				device.init(function () {
					console.log("post-init callback start");
					success_cb(device);
				}, error_cb);
			}
});

}

function requireFromString(src) {
	// turns a code string into a loaded module
	var Module = module.constructor;
	var m = new Module();
	m.paths = module.paths;
	m._compile(src);
	//console.log(m);
	return m.exports;
}

function get_exports (accessor) {
	// need to keep a list of module exports for toplevel to call
	// var export_str = "module.exports = {};\n";
	var export_str = "";

	// behold the power of regular expressions!
	// var functions_list = code.match(/(function)\*? \w+/g);

	// TODO: only export port functions
	//       need to make sure that accessor has the mapped function names


	for (var i=0; i<accessor.ports.length; i++) {
		var port = accessor.ports[i];
		var name = port.name;

		var func = port.function || port.name;

		// var wrapper = 'function () {set("'+name+'", arguments[0]); _do_port_call.apply(this, [' + func + '].concat(Array.prototype.slice.call(arguments)))};\n'
		var wrapper = 'function () {set("'+name+'", arguments[0]); _do_port_call.apply(this, [' + func + ', arguments[0], arguments[1]])};\n'

		export_str += 'module.exports["'+name+'"] = ' + wrapper;
		export_str += 'module.exports["'+func+'"] = ' + wrapper;
	}

	export_str += '\nmodule.exports.init = function (succ_cb, err_cb) {\n';
	export_str += '  rt.log.debug("About to init ' + accessor.name + '");\n';
	export_str += '  _do_port_call(init, null, succ_cb, err_cb);\n';
	export_str += '};\n';

	// if (functions_list) {
	//     for (var i=0; i<functions_list.length; i++) {
	//         decl = functions_list[i];
	//         func_name = decl.split(' ')[1];

	//         // YYY: what did this do?

	//   //       if (func_name == '')
	// 		// if (decl.indexOf('*') > -1) {
	// 		// 	new_decl = 'var ' + func_name + ' = function*';
	// 		// } else {
	// 		// 	new_decl = 'var ' + func_name + ' = function*';
	// 		// }
	//         // code = code.replace(decl, new_decl);
	//         export_str += 'module.exports["'+func_name + '"]= function () {set("'+func_name+'", arguments[0]); _do_port_call.apply(this, [' + func_name + '].concat(Array.prototype.slice.call(arguments)))};\n';
	// 		export_str += 'module.exports["'+func_name + '"]= function () {set("'+func_name+'", arguments[0]); _do_port_call.apply(this, [' + func_name + '].concat(Array.prototype.slice.call(arguments)))};\n';
	//     }
	// }

	export_str += 'module.exports.get= get;\n';
	export_str += 'module.exports.set= set;\n';

	// console.log(code);
	return export_str;
}

exports.create_accessor = create_accessor;

