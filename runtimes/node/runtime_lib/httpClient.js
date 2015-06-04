var debug_lib = require('debug');
var Q         = require('q');
var request   = require('request');

var debug = debug_lib('accessors:httpClient:debug');
var info  = debug_lib('accessors:httpClient:info');
var warn  = debug_lib('accessors:httpClient:warn');
var error = debug_lib('accessors:httpClient:error');


function* request_fn(options) {
	info("httpRequest("
		+ (function(obj) {
			result=[];
			for(p in obj) {
				result.push(JSON.stringify(obj[p]));
			};
			return result;
		})(arguments)
		+ ")");

	var request_defer = Q.defer();

	var req = request(options, function (error, response, body) {
		if (!error) {
			if (response.statusCode == 200) {
				request_defer.resolve({
					body: body,
					statusMessage: response.statusMessage,
					statusCode: response.statusCode
				});
			} else {
				request_defer.reject("httpRequest failed with code " + request.statusCode + " at URL: " + url);
			}
		} else {
			request_defer.reject("httpRequest at URL: " + url + " had an error: \n" + error);
		}
	});

	info('before yield in rt.http.request');
	return yield request_defer.promise;
}

module.exports.requestFinish = request_fn;

module.exports.get = function* get(url) {
	var options = {}

	if (typeof url === 'object') {
		options = url;
	} else {
		options.url = url;
	}
	options.method = 'GET';

	info("runtime_lib::get before yield*");
	return yield* request_fn(options);
	info("runtime_lib::get after yield*");
}

module.exports.post = function* post(url, body) {
	var options = {}

	if (typeof url === 'object') {
		options = url;
	} else {
		options.url = url;
	}
	options.method = 'POST';
	options.body = body;

	return yield* request_fn(options);
}

module.exports.put = function* put(url, body) {
	var options = {}

	if (typeof url === 'object') {
		options = url;
	} else {
		options.url = url;
	}
	options.method = 'PUT';
	options.body = body;

	return yield* request_fn(options);
}