var debug_lib    = require('debug');
var Q            = require('q');
var socketio_old = require('socket.io-client');

var debug = debug_lib('accessors:gatdOld:debug');
var info  = debug_lib('accessors:gatdOld:info');
var warn  = debug_lib('accessors:gatdOld:warn');
var error = debug_lib('accessors:gatdOld:error');

module.exports.Client = function* (url) {
	var g = Object();
	var conn;

	info('GATD OLD connecting to ' + url);
	var defer = Q.defer();
	var conn = socketio_old.connect(url);
	conn.on('connect', function () {
		info('GATD OLD connected');
		defer.resolve(g);
	});

	g.query = function (query, callback) {
		conn.emit('query', query);
		conn.on('data', callback);
	}

	return yield defer.promise;
}
