var dns = require('dns');

var dbg = require('debug');
var Q   = require('q');

var debug = dbg('accessors:coap:debug');
var info  = dbg('accessors:coap:info');
var warn  = dbg('accessors:coap:warn');
var error = dbg('accessors:coap:error');

module.exports.Client = function () { };

module.exports.Client.prototype.lookup = function* (hostname) {
	var defer = Q.defer();

	dns.lookup(hostname, function (err, address, family) {
		defer.resolve(address);
	});

	return yield defer.promise;
}
