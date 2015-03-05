var amqp = require('amqp');

var config = require('./config');

/*
 * Pull packets from AMQP queue and put them in the system
 */

function BLE () {

	var outputs = new Array(1);
	this.outputs = outputs;

	this.run = function () {
		var rmq = amqp.createConnection(config.rabbitmq);
		rmq.on('ready', function () {

			rmq.queue('', function (q) {
				q.bind(config.rabbitmq.exchange, "scanner.#", function () {
					q.subscribe(function (message, headers, deliveryInfo, messageObject) {
						var pkt = JSON.parse(message.data);
						console.log(pkt.name);
						outputs[0]({'event_str': pkt.name});
					});
				});
			});
		});
	}

}

module.exports = BLE;
