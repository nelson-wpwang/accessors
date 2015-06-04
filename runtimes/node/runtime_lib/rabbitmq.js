var amqp      = require('amqp');
var debug_lib = require('debug');
var Q         = require('q');

var debug = debug_lib('accessors:rabbitmq:debug');
var info  = debug_lib('accessors:rabbitmq:info');
var warn  = debug_lib('accessors:rabbitmq:warn');
var error = debug_lib('accessors:rabbitmq:error');


module.exports.Client = function* (url) {
	var a = Object();

	info('AMQP Connect: ' + url);
	var defer = Q.defer();
	var conn = amqp.createConnection({url: url});
	conn.on('ready', function () {
		defer.resolve(a);
	});

	a.subscribe = function (exchange, routing_key, callback) {
		conn.queue('', function (q) {
			q.bind(exchange, routing_key, function () {
				q.subscribe(function (message, headers, deliveryinfo, messageObject) {
					var pkt = JSON.parse(message.data);
					callback(pkt);
				});
			});
		});
	}

	return yield defer.promise;
}
