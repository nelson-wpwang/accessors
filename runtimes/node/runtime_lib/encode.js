var atob = require('atob');
var btoa = require('btoa');


module.exports.atob = function (b64) {
	return atob(b64);
}

module.exports.btoa = function (str) {
	return btoa(str);
}
