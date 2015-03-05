
var util = require('util');
var readline = require('readline');

var _ = require('lodash');

var match = require('./match')
var not = require('./not')


function Lights4908 () {

	this.inputs = [

		function (state) {
			if (state) {
				console.log('Lights4908: turning lab lights on');
			} else {
				console.log('Lights4908: turning lab lights off');
			}
		}

	]

}

var block_names = {
	'Match': match,
	'Not': not,
	'Lights4908': Lights4908
}


var profile_desc = {
	blocks: [
		{
			type: 'Match',
			uuid: '1',
			parameters: {
				key: 'event_str',
				matches: [
					'in',
					'out',
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


var profile_tree = {
	blocks: {},
}

var profile = {
	blocks: {},
}

// Create an object for each block
_.forEach(profile_desc.blocks, function (block, index) {
	profile.blocks[block.uuid] = new block_names[block['type']](block.parameters);
});

// Insert all of the correct calls
_.forEach(profile_desc.connections, function (conn, index) {
	src = conn.src.split('.');
	if (src.length == 2) {
		src_block = src[0];
		src_port = parseInt(src[1]);
	} else {
		src_block = src[0];
		src_port = 0;
	}

	dst = conn.dst.split('.');
	if (dst.length == 2) {
		dst_block = dst[0];
		dst_port = parseInt(dst[1]);
	} else {
		dst_block = dst[0];
		dst_port = 0;
	}

	profile.blocks[src_block].outputs[src_port] = profile.blocks[dst_block].inputs[dst_port];
});

// test
// profile.blocks['1'].inputs[0]({'event_str': 'in'});
// profile.blocks['1'].inputs[0]({'event_str': 'out'});
// profile.blocks['1'].inputs[0]({'event_str': 'huh?'});




var rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

function getinput () {
	rl.question("['in', 'out', 'huh?']: ", function(answer) {
		profile.blocks['1'].inputs[0]({'event_str': answer});

		getinput();
	});
}

getinput();

// function test_match_a (bool) {
// 	console.log('GOT A');
// }

// function test_match_b (bool) {
// 	console.log('GOT B');
// }

// function test_not_inverted (boola) {
// 	console.log('INVERTED: ' + boola);
// }


// var test_not = new not(test_not_inverted);
// console.log(util.inspect(test_not))
// test_not.input(true)
// var test_match = new match('str', ['a', 'b', 'b'], [test_match_a, test_not.input]);


// var test1 = {
// 	dummykey: 'Cool',
// 	str: 'a',
// };
// var test2 = {
// 	str: 'c'
// };
// var test3 = {
// 	str: 'b'
// };

// console.log('running TEST1');
// test_match.input(test1);

// console.log('running TEST2');
// test_match.input(test2);

// console.log('running TEST3');
// test_match.input(test3);



