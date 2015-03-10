
var central = require('./central');
var config = require('./config');

// Define our test.
// This pulls packets from BLE scan queue, puts them in match, feeds one
// output of match into a not, and feeds both of those into the 4908lights
// block, which will be an accessor some day.
var profile_desc = {
	blocks: [
		{
			type: 'accessor',
			path: '/webquery/RabbitMQ',
			parameters: {
				amqp_url: 'amqp://' + config.rabbitmq.login + ':' +
				           config.rabbitmq.password + '@' +
				           config.rabbitmq.host + '/' + config.rabbitmq.vhost,
				amqp_exchange: config.rabbitmq.exchange,
				amqp_routing_key: 'event.presence.UniversityofMichigan.BBB.4908.#',
			},
			uuid: 'PullWearabouts'
		},
		{
			type: 'Match',
			parameters: {
				key: 'name',
				matches: [
					'Monoxalyze',
					'squall',
					'huh?'
				]
			},
			uuid: 'MatchEvents',
		},
		{
			type: 'Not',
			uuid: '2'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.ip_addr,
			},
			uuid: 'AcmeWorkbenchRight'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.ip_addr,
			},
			uuid: 'AcmeWorkbenchLeft'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.ip_addr,
			},
			uuid: 'AcmeOverheadLights'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.ip_addr,
			},
			uuid: 'AcmeYeshengLight'
		},
		{
			type: 'accessor',
			path: '/lighting/hue/allbridgehues',
			parameters: {
				bridge_url: config.hues.bridge_url,
				username: config.hues.username,
			},
			uuid: 'HueAll'
		},
		{
			type: 'accessor',
			path: '/switch/wemo',
			parameters: {
				wemo_url: config.sconce.wemo_url,
			},
			uuid: 'WemoSamSconce'
		}
	],
	connections: [
		{
			src: 'PullWearabouts.Data',
			dst: 'MatchEvents.0'
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
