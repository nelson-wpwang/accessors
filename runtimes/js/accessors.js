var request = require('request');
var fs = require('fs');

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

function create_accessor (path, parameters, cb) {

  if (parameters == undefined) {
    parameters = {};
  }

console.log(path);
  request('http://localhost:6565/accessor'+path+'.json', function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var accessor = JSON.parse(body);
      // console.log(accessor)

      var ports = {};
      for (var i=0; i<accessor.ports.length; i++) {
        ports[accessor.ports[i].name] = '';
      }
      // console.log(ports);
    

    	//console.log("JSON Data:\n", json_data.code);

    	//XXX: Implement something to figure out the runtime imports neccessary
    	//	Some of these are from runtime and some are from Hue
    	var requires = "var Q = require('q');\nvar request = require('request');\nvar tinycolor = require('tinycolor2');\nvar atob = require('atob');\nvar btoa = require('btoa');\nvar color = require('color');var rt = require('./runtime_web.js');\n";
    	//XXX: autogenerate these
    	//	Also figure out what their default values should be
    	var ports_str = "var ports = "+JSON.stringify(ports)+";\n";
      console.log(ports_str);
    	//XXX: autogenerate these
    	//	Also figure out what their default values should be
    	var params = "var parameters = "+JSON.stringify(parameters)+";\n";
      console.log(params);
    	var runtime_code = fs.readFileSync('runtime_help.js');
    	var exports = get_exports(accessor);

      // code = 'var rt = require("./runtime_web.js");\n' + code;

    	// turn the code into a module
    	var device = requireFromString(requires + ports_str + params + runtime_code + accessor.code + exports);

      // console.log(requires + ports_str + params +  runtime_code + accessor_code);

      console.log(device);

      device.init();

      cb(device);

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
      var func = port.function;

      // var wrapper = 'function () {set("'+name+'", arguments[0]); _do_port_call.apply(this, [' + name + '].concat(Array.prototype.slice.call(arguments)))};\n'
      var wrapper = 'function () { console.log("cool"); _do_port_call.apply(this, [' + func + '].concat(Array.prototype.slice.call(arguments)))}; console.log("cooler");\n'

      export_str += 'module.exports["'+name+'"] = ' + wrapper;
      export_str += 'module.exports["'+func+'"] = ' + wrapper;
    }

    export_str += 'module.exports.init= function () { _do_port_call(init); };\n';



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

		// export_str += '};\n'
		// code += export_str;

		//console.log(code);
    

    // console.log(code);
    return export_str;
}

exports.create_accessor = create_accessor;

