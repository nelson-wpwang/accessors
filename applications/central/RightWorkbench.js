
var central = require('./central');
var config = require('./config');


var profile_desc = {
	blocks: [
		{
			type: 'accessor',
			path: '/webquery/GatdOld',
			parameters: {
				gatd_url: config.gatdold.url,
				gatd_query: config.gatdold.coilcube_query,
			},
			uuid: 'PullCoilcube'
		},
		{
			type: 'Filter',
			parameters: {
				filters: [['ccid_mac', 'c0:98:e5:43:4f:f3:76:72']]
			},
			uuid: 'CoilcubeFilter'
		},
		{
			type: 'Threshold',
			parameters: {
				key: 'freq',
				threshold: 0.05
			},
			uuid: 'Threshold'
		},
		{
			type: 'Constant',
			parameters: {
				constant: {delay: 60000, delayed_msg: false}
			},
			uuid: 'Constant'
		},
		{
			type: 'Delay',
			uuid: 'TurnOffDelay'
		},
		// {
		// 	type: 'Transistor',
		// 	uuid: 'WearaboutsSwitch'
		// },
		// {
		// 	type: 'Keyway',
		// 	parameters: {
		// 		key: 'override'
		// 	},
		// 	uuid: 'OverrideKeyway'
		// },
		// {
		// 	type: 'Delay',
		// 	uuid: 'OverrideDelay'
		// },
		// {
		// 	type: 'Match',
		// 	parameters: {
		// 		key: 'event_str',
		// 		matches: [
		// 			'Location occupied',       // 0
		// 			'Location not occupied',   // 1
		// 			'samkuo in location',      // 2
		// 			'samkuo not in location',  // 3
		// 		]
		// 	},
		// 	uuid: 'MatchEvents',
		// },
		// {
		// 	type: 'Not',
		// 	uuid: 'Not0'
		// },
		// {
		// 	type: 'Not',
		// 	uuid: 'Not1'
		// },
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.workbench_right_ip_addr,
			},
			uuid: 'AcmeWorkbenchRight'
		},
		// {
		// 	type: 'accessor',
		// 	path: '/switch/acme++',
		// 	parameters: {
		// 		ip_addr: config.acme.workbench_left_ip_addr,
		// 	},
		// 	uuid: 'AcmeWorkbenchLeft'
		// },
		// // {
		// // 	type: 'accessor',
		// // 	path: '/switch/acme++',
		// // 	parameters: {
		// // 		ip_addr: config.acme.overhead_ip_addr,
		// // 	},
		// // 	uuid: 'AcmeOverheadLights'
		// // },
		// // {
		// // 	type: 'accessor',
		// // 	path: '/switch/acme++',
		// // 	parameters: {
		// // 		ip_addr: config.acme.yesheng_ip_addr,
		// // 	},
		// // 	uuid: 'AcmeYeshengLight'
		// // },
		// {
		// 	type: 'accessor',
		// 	path: '/lighting/hue/allbridgehues',
		// 	parameters: {
		// 		bridge_url: config.hues.bridge_url,
		// 		username: config.hues.username,
		// 	},
		// 	uuid: 'HueAll'
		// },
		{
			type: 'accessor',
			path: '/tests/print',
			uuid: 'Print'
		}
	],
	connections: [
		// {
		// 	src: 'PullWearabouts.Data',
		// 	dst: 'WearaboutsSwitch.in'
		// },
		// {
		// 	src: 'WearaboutsSwitch.out',
		// 	dst: 'MatchEvents.0'
		// },
		// {
		// 	src: 'PullOverride.Data',
		// 	dst: 'OverrideKeyway'
		// },
		// {
		// 	src: 'PullOverride.Data',
		// 	dst: 'OverrideDelay.delay'
		// },
		// {
		// 	src: 'PullOverride.Data',
		// 	dst: 'MatchEvents.0'
		// },
		// {
		// 	src: 'OverrideKeyway.0',
		// 	dst: 'WearaboutsSwitch.gate'
		// },
		// {
		// 	src: 'OverrideDelay.0',
		// 	dst: 'WearaboutsSwitch.gate'
		// },
		// {
		// 	src: 'MatchEvents.1',
		// 	dst: 'Not0'
		// },
		// {
		// 	src: 'Not0',
		// 	dst: 'AcmeWorkbenchRight.PowerControl'
		// },
		// {
		// 	src: 'MatchEvents.2',
		// 	dst: 'AcmeWorkbenchLeft.PowerControl'
		// },
		// {
		// 	src: 'MatchEvents.3',
		// 	dst: 'Not1'
		// },
		// {
		// 	src: 'Not1',
		// 	dst: 'AcmeWorkbenchLeft.PowerControl'
		// }
		// // {
		// // 	src: '2',
		// // 	dst: 'acme_workbench.PowerControl'
		// // },
		{
			src: 'PullCoilcube.Data',
			dst: 'CoilcubeFilter.0'
		},
		{
			src: 'CoilcubeFilter.0',
			dst: 'Threshold.0'
		},
		{
			src: 'Threshold.0',
			dst: 'AcmeWorkbenchRight.PowerControl'
		},
		{
			src: 'Threshold.0',
			dst: 'Constant.0'
		},
		{
			src: 'Constant.0',
			dst: 'TurnOffDelay.delay'
		},
		{
			src: 'TurnOffDelay.0',
			dst: 'AcmeWorkbenchRight.PowerControl'
		},
		{
			src: 'Constant.0',
			dst: 'Print.Print'
		}
	]
}

c = new central(profile_desc);
