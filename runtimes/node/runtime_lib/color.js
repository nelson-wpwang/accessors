var debug_lib = require('debug');
var tinycolor = require('tinycolor2');

var debug = debug_lib('accessors:color:debug');
var info  = debug_lib('accessors:color:info');
var warn  = debug_lib('accessors:color:warn');
var error = debug_lib('accessors:color:error');


module.exports.hex_to_hsv = function (hex_code) {
	c = tinycolor('#'+hex_code);
	return c.toHsv();
};

module.exports.hsv_to_hex = function (hsv) {
	c = tinycolor(hsv);
	return c.toHex();
};
