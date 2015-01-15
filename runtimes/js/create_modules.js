var http = require('http');
var fs = require('fs');

//XXX: Should include actual dependencies somehow and only push these into the module
var req_lib = require('request');
var tinycolor = require('tinycolor2');
var atob = require('atob');
var btoa = require('btoa');


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
hue.init();
hue.get_bulb_id();
console.log('done');

function create_accessor(json_data) {
    //console.log("JSON Data:\n", json_data.code);
    
		var runtime_code = fs.readFileSync('runtime_web.js');
    var accessor_code = fix_functions(json_data.code);

    return requireFromString(runtime_code + accessor_code);
}

function requireFromString(src) {
    var Module = module.constructor;
    var m = new Module();
    m._compile(src);
    //console.log(m);
    return m.exports;
}

function fix_functions(code) {
    // behold the power of regular expressions!
    var res = code.match(/(function)\*? \w+/g);
    
    if (res) {
        for (var i=0; i<res.length; i++) {
            decl = res[i];
            func_name = decl.split(' ')[1];
            new_decl = 'module.exports.' + func_name + ' = ' + decl;
            code = code.replace(decl, new_decl);
        }
    }

    return code;
}

