var http = require('http');
var fs = require('fs');

//XXX: Should include actual dependencies somehow and only push these into the module

var json_data = '';

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
var json_str = fs.readFileSync('huesingle.json', 'utf8');
//var json_str = fs.readFileSync('test.json', 'utf8');
// ---------------------------

var hue = create_accessor(JSON.parse(json_str));
var promise = hue.init().next().value;
promise.then(function(){promise = hue.get_buld_id().next().value;});

function create_accessor(json_data) {
	//console.log("JSON Data:\n", json_data.code);

	//XXX: Implement something to figure out the runtime imports neccessary
	//	Some of these are from runtime and some are from Hue
	var requires = "var Q = require('q');\nvar request = require('request');\nvar tinycolor = require('tinycolor2');\nvar atob = require('atob');\nvar btoa = require('btoa');\nvar color = require('color');";
	//XXX: autogenerate these
	//	Also figure out what their default values should be
	var ports = "var ports = {'Power': '', 'Color': '', 'Brightness': '', 'BulbName': '', 'Bulbs': ''};\n";
	//XXX: autogenerate these
	//	Also figure out what their default values should be
	var params = "var parameters = {'bridge_url': '???', 'username': '???'};\n";
	var runtime_code = fs.readFileSync('runtime_web.js');
	var accessor_code = fix_functions(json_data.code);

	// turn the code into a module
	return requireFromString(requires + ports + params + runtime_code + accessor_code);
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

function fix_functions(code) {
	// need to keep a list of module exports for toplevel to call
		var export_str = "module.exports = {"

    // behold the power of regular expressions!
    var functions_list = code.match(/(function)\*? \w+/g);
    
    if (functions_list) {
        for (var i=0; i<functions_list.length; i++) {
            decl = functions_list[i];
            func_name = decl.split(' ')[1];
						if (decl.indexOf('*') > -1) {
							new_decl = 'var ' + func_name + ' = function*';
						} else {
							new_decl = 'var ' + func_name + ' = function*';
						}
            code = code.replace(decl, new_decl);
						export_str += func_name + ': ' + func_name + ', ';
        }
    }

		export_str += '};\n'
		code += export_str;

		//console.log(code);
    return code;
}

