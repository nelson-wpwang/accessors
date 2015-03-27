
var central = require('./central');
var config = require('./config');


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
				amqp_routing_key: 'event.presence.University_of_Michigan.BBB.4908.#',
			},
			uuid: 'PullWearabouts'
		},
		{
			type: 'Keyway',
			parameters: {
				key: 'event_str'
			},
			uuid: 'EventStringKeyway'
		},
		{
			type: 'Match',
			parameters: {
				matches: [
					'bradjc in location',      // 0
					'bradjc not in location'   // 1
				]
			},
			uuid: 'MatchEvents',
		},
		{
			type: 'Constant',
			parameters: {
				constant: {Power: true, Color: '0892d0', Brightness: 35}
			},
			uuid: 'ConstantEnteredSettings'
		},
		{
			type: 'accessor',
			path: '/lighting/hue/huesingle',
			parameters: {
				bridge_url: config.hues.bridge_url,
				username: config.hues.username,
				bulb_name: 'Brad'
			},
			uuid: 'Hue'
		},
		// What to set HUE to when person leaves
		{
			type: 'Constant',
			parameters: {
				constant: {Power: true, Color: 'fffdd0', Brightness: 35}
			},
			uuid: 'ConstantLeftSettings'
		},
		// What to set HUE to 1 minute after the person leaves
		{
			type: 'Constant',
			parameters: {
				constant: {Power: true, Color: 'ffcba4', Brightness: 35, delay: 60000}
			},
			uuid: 'ConstantLeft1minSettings'
		},
		// What to set HUE to 5 minutes after the person left
		{
			type: 'Constant',
			parameters: {
				constant: {Power: true, Color: 'ff4040', Brightness: 35, delay: 300000}
			},
			uuid: 'ConstantLeft5minSettings'
		},
		// What to set HUE to 10 minutes after the person left
		{
			type: 'Constant',
			parameters: {
				constant: {Power: false, Color: '000000', Brightness: 0, delay: 600000}
			},
			uuid: 'ConstantLeft10minSettings'
		},
		{
			type: 'Delay',
			uuid: 'Left1minDelay'
		},
		{
			type: 'Delay',
			uuid: 'Left5minDelay'
		},
		{
			type: 'Delay',
			uuid: 'Left10minDelay'
		},

		// RESET constant block
		{
			type: 'Constant',
			parameters: {
				constant: {delay: -1}
			},
			uuid: 'ConstantReset'
		},
	],
	connections: [
		{
			src: 'PullWearabouts.Data',
			dst: 'EventStringKeyway'
		},
		{
			src: 'EventStringKeyway',
			dst: 'MatchEvents'
		},
		{
			src: 'MatchEvents.0',
			dst: 'ConstantEnteredSettings'
		},
		{
			src: 'ConstantEnteredSettings',
			dst: 'Hue.PCB'
		},
		{
			src: 'MatchEvents.1',
			dst: 'ConstantLeftSettings'
		},
		{
			src: 'ConstantLeftSettings',
			dst: 'Hue.PCB'
		},

		{
			src: 'MatchEvents.1',
			dst: 'ConstantLeft1minSettings'
		},
		{
			src: 'MatchEvents.1',
			dst: 'ConstantLeft5minSettings'
		},
		{
			src: 'MatchEvents.1',
			dst: 'ConstantLeft10minSettings'
		},

		{
			src: 'ConstantLeft1minSettings',
			dst: 'Left1minDelay'
		},
		{
			src: 'ConstantLeft5minSettings',
			dst: 'Left5minDelay'
		},
		{
			src: 'ConstantLeft10minSettings',
			dst: 'Left10minDelay'
		},

		{
			src: 'Left1minDelay',
			dst: 'Hue.PCB'
		},
		{
			src: 'Left5minDelay',
			dst: 'Hue.PCB'
		},
		{
			src: 'Left10minDelay',
			dst: 'Hue.PCB'
		},

		// RESET
		{
			src: 'MatchEvents.0',
			dst: 'ConstantReset'
		},
		{
			src: 'ConstantReset',
			dst: 'Left1minDelay'
		},
		{
			src: 'ConstantReset',
			dst: 'Left5minDelay'
		},
		{
			src: 'ConstantReset',
			dst: 'Left10minDelay'
		},
	]
}

c = new central(profile_desc);
