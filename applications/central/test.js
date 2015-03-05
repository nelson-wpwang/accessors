
var central = require('./central');

// Define our test.
// This pulls packets from BLE scan queue, puts them in match, feeds one
// output of match into a not, and feeds both of those into the 4908lights
// block, which will be an accessor some day.
var profile_desc = {
	blocks: [
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
					'in',
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
			type: 'Lights4908',
			uuid: '3'
		}
	],
	connections: [
		{
			src: '00',
			dst: '1'
		},
		{
			src: '1.0',
			dst: '3'
		},
		{
			src: '1.1',
			dst: '2'
		},
		{
			src: '2',
			dst: '3'
		}
	]
}

c = new central(profile_desc);
