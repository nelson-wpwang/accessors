
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
				amqp_routing_key: 'event.presence.University_of_Michigan.BBB.4908.#',
			},
			uuid: 'PullWearabouts'
		},
		{
			type: 'accessor',
			path: '/webquery/RabbitMQ',
			parameters: {
				amqp_url: 'amqp://' + config.rabbitmq.login + ':' +
				           config.rabbitmq.password + '@' +
				           config.rabbitmq.host + '/' + config.rabbitmq.vhost,
				amqp_exchange: config.rabbitmq.exchange,
				amqp_routing_key: 'event.override.University_of_Michigan.BBB.4908.#',
			},
			uuid: 'PullOverride'
		},
		{
			type: 'Transistor',
			uuid: 'WearaboutsSwitch'
		},
		{
			type: 'Keyway',
			parameters: {
				key: 'override'
			},
			uuid: 'OverrideKeyway'
		},
		{
			type: 'Delay',
			uuid: 'OverrideDelay'
		},
		{
			type: 'Match',
			parameters: {
				key: 'event_str',
				matches: [
					'Location occupied',       // 0
					'Location not occupied',   // 1
					'samkuo in location',      // 2
					'samkuo not in location',  // 3
                    'Room lights on',          // 4
                    'Room lights off',         // 5
                    'Panel on',                // 6
                    'Panel off',               // 7
                    'Workbench right on',      // 8
                    'Workbench right off',     // 9
                    "Workbench left on",       // 10
                    'Workbench left off'       // 11
				]
			},
			uuid: 'MatchEvents',
		},
		{
			type: 'Not',
			uuid: 'Not0'
		},
		{
			type: 'Not',
			uuid: 'Not1'
		},
		{
			type: 'Not',
			uuid: 'Not2'
		},
		{
			type: 'Not',
			uuid: 'Not3'
		},
		{
			type: 'Not',
			uuid: 'Not4'
		},
		{
			type: 'Not',
			uuid: 'Not5'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.workbench_right_ip_addr,
			},
			uuid: 'AcmeWorkbenchRight'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.workbench_left_ip_addr,
			},
			uuid: 'AcmeWorkbenchLeft'
		},
		//{
		//	type: 'accessor',
		//	path: '/switch/acme++',
		//	parameters: {
		//		ip_addr: config.acme.overhead_ip_addr,
		//	},
		//	uuid: 'AcmeOverheadLights'
		//},
		//{
		//	type: 'accessor',
		//	path: '/switch/acme++',
		//	parameters: {
		//		ip_addr: config.acme.yesheng_ip_addr,
		//	},
		//	uuid: 'AcmeYeshengLight'
		//},
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
			dst: 'WearaboutsSwitch.in'
		},
		{
			src: 'WearaboutsSwitch.out',
			dst: 'MatchEvents.0'
		},
		{
			src: 'PullOverride.Data',
			dst: 'OverrideKeyway'
		},
		{
			src: 'PullOverride.Data',
			dst: 'OverrideDelay.delay'
		},
		{
			src: 'PullOverride.Data',
			dst: 'MatchEvents.0'
		},
		{
			src: 'OverrideKeyway.0',
			dst: 'WearaboutsSwitch.gate'
		},
		{
			src: 'OverrideDelay.0',
			dst: 'WearaboutsSwitch.gate'
		},
        //{
        //    src: 'MatchEvents.0',
        //    dst: 'AcmeOverheadLights.PowerControl'
        //},
        {
            src: 'MatchEvents.1',
            dst: 'Not0'
        },
        {
            src: 'Not0',
            dst: 'AcmeWorkbenchRight.PowerControl'
        },
        {
            src: 'Not0',
            dst: 'AcmeWorkbenchLeft.PowerControl'
        },
        //{
        //    src: 'Not0',
        //    dst: 'AcmeOverheadLights.PowerControl'
        //},
        //{
        //    src: 'Not0',
        //    dst: 'AcmeYeshengLight.PowerControl'
        //},
        //{
        //    src: 'MatchEvents.2',
        //    dst: 'AcmeYeshengLight.PowerControl'
        //},
        {
            src: 'MatchEvents.3',
            dst: 'Not1'
        },
        //{
        //    src: 'Not1',
        //    dst: 'AcmeYeshengLight.PowerControl'
        //},
        //{
        //    src: 'MatchEvents.4',
        //    dst: 'AcmeOverheadLights.PowerControl'
        //},
        {
            src: 'MatchEvents.5',
            dst: 'Not2',
        },
        //{
        //    src: 'Not2',
        //    dst: 'AcmeOverheadLights.PowerControl'
        //},
        //{
        //    src: 'MatchEvents.6',
        //    dst: 'AcmeYeshengLight.PowerControl'
        //},
        {
            src: 'MatchEvents.7',
            dst: 'Not3'
        },
        //{
        //    src: 'Not3',
        //    dst: 'AcmeYeshengLight.PowerControl'
        //},
        {
            src: 'MatchEvents.8',
            dst: 'AcmeWorkbenchRight.PowerControl'
        },
        {
            src: 'MatchEvents.9',
            dst: 'Not4'
        },
        {
            src: 'Not4',
            dst: 'AcmeWorkbenchRight.PowerControl'
        },
        {
            src: 'MatchEvents.10',
            dst: 'AcmeWorkbenchLeft.PowerControl'
        },
        {
            src: 'MatchEvents.11',
            dst: 'Not5'
        },
        {
            src: 'Not5',
            dst: 'AcmeWorkbenchLeft.PowerControl'
        }
	]
}

c = new central(profile_desc);
