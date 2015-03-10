
var central = require('./central');
var config = require('./config');

// Define our test.
// This pulls packets from BLE scan queue, puts them in match, feeds one
// output of match into a not, and feeds both of those into the 4908lights
// block, which will be an accessor some day.
var profile_desc = {
	blocks: [
		// {
		// 	type: 'accessor',
		// 	path: '/webquery/RabbitMQ',
		// 	parameters: {
		// 		amqp_url: 'amqp://' + config.rabbitmq.login + ':' + \
		// 		           config.rabbitmq.password + '@' + \
		// 		           config.rabbitmq.host + '/' + config.rabbitmq.vhost,
		// 		amqp_exchange: config.rabbitmq.exchange,
		// 		amqp_routing_key: 'scanner.#'
		// 	}
		// 	uuid: '00'
		// },
		{
			type: 'BLE',
			uuid: '00'
		},
		{
			type: 'Match',
			uuid: '1',
			parameters: {
				key: 'event_str',
				matches: [
					'Monoxalyze',
					'squall',
					'huh?'
				]
			}
		},
		{
			type: 'Not',
			uuid: '2'
		},
		{
			type: 'accessor',
			path: '/tests/print',
			uuid: '3'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.ip_addr,
			},
			uuid: 'acme_workbench'
		}
	],
	connections: [
		{
			src: '00.0',
			dst: '1.0'
		},
		{
			src: '1.0',
			dst: '3.Print'
		},
		{
			src: '1.1',
			dst: '2'
		},
		{
			src: '2',
			dst: '3.Print'
		},
		// {
		// 	src: '2',
		// 	dst: 'acme_workbench.PowerControl'
		// },
		// {
		// 	src: '1.0',
		// 	dst: 'acme_workbench.PowerControl'
		// }
	]
}

c = new central(profile_desc);
