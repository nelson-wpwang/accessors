
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
			path: '/tests/print',
			uuid: 'Print'
		}
	],
	connections: [
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
