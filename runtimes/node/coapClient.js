var coap      = require('coap');
var debug_lib = require('debug');
var Q         = require('q');
var through2 = require('through2');

var debug = debug_lib('accessors:coap:debug');
var info  = debug_lib('accessors:coap:info');
var warn  = debug_lib('accessors:coap:warn');
var error = debug_lib('accessors:coap:error');


function* _coapCommon(ogm) {
	var defer = Q.defer();
	ogm.on('response', function (resp) {
		var content = resp.payload.toString('utf-8')
		info("CoAP complete, resp payload: " + content);
		defer.resolve(content);
	});
	info("CoAP yielding for I/O operation");
	return yield defer.promise;
}

module.exports.get = function* (url) {
	info("CoAP GET: " + url);
	var params = urllib.parse(url);
	params.method = 'GET';
	var ogm = coap.request(params);
	ogm.end();
	return yield* _coapCommon(ogm);
}

module.exports.post = function* (url, body) {
	info("CoAP POST: " + url + " -- with body:");
	info(body);
	var params = urllib.parse(url);
	params.method = 'POST';
	var ogm = coap.request(params);
	ogm.write(body);
	ogm.end();
	return yield* _coapCommon(ogm);
}

module.exports.observe = function (url, callback) {
	info("CoAP OBSERVE: " + url);
	var params = urllib.parse(url);
	params.observe = true;
	var ogm = coap.request(params);
	ogm.on('response', function (resp) {
		resp.pipe(through2(function (chunk, enc, t2callback) {
			info('CoAP obSERve cb');
			callback(chunk.toString('utf-8'));
			t2callback();
		}));
	});
	ogm.end();
}
