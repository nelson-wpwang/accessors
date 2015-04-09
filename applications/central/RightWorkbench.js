
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
			type: 'Keyway',
			parameters: {
				key: 'freq'
			},
			uuid: 'FilteredKeyway'
		},
		{
			type: 'Threshold',
			parameters: {
				key: 'freq',
				threshold: 0.01
			},
			uuid: 'Threshold'
		},
		{
			type: 'Constant',
			parameters: {
				constant: {delay: 600000}
			},
			uuid: 'Constant'
		},
		{
			type: 'Delay',
			uuid: 'TurnOffDelay'
		},
		{
			type: 'Constant',
			parameters: {
				constant: false
			},
			uuid: 'ConstantTurnOff'
		},
		{
			type: 'accessor',
			path: '/switch/acme++',
			parameters: {
				ip_addr: config.acme.workbench_right_ip_addr,
			},
			uuid: 'AcmeWorkbenchRight'
		}
	],
	connections: [
		{
			src: 'PullCoilcube.Data',
			dst: 'CoilcubeFilter.0'
		},
		{
			src: 'CoilcubeFilter.0',
			dst: 'FilteredKeyway'
		},
		{
			src: 'FilteredKeyway',
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
			dst: 'TurnOffDelay.0'
		},
		{
			src: 'TurnOffDelay.0',
			dst: 'ConstantTurnOff'
		},
		{
			src: 'ConstantTurnOff',
			dst: 'AcmeWorkbenchRight.PowerControl'
		}
	]
}

c = new central(profile_desc);
