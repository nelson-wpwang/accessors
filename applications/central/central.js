
var util = require('util');

var _ = require('lodash');
var async = require('async');


var match = require('./match');
var not = require('./not');
var ble = require('./ble');
var lights4908 = require('./lights4908');

var accessor = require('./accessor_wrapper');


var block_names = {
	'Match': match,
	'Not': not,
	'Lights4908': lights4908,
	'BLE': ble
}


function Central (profile_desc) {

	var profile = {
		blocks: {},
	}

	// Create an object for each block
	var calls = [];
	_.forEach(profile_desc.blocks, function (block, index) {
		if (block.type == 'accessor') {
			calls.push(function (callback) {
				profile.blocks[block.uuid] = new accessor(block.path, block.parameters, callback);
			});
		} else {
			calls.push(function (callback) {
				profile.blocks[block.uuid] = new block_names[block.type](block.parameters, callback);
			});
		}
	});

	async.parallel(calls, function (err, result) {

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

			console.log('Connecting ' + conn.src + ' to ' + conn.dst);
			profile.blocks[src_block].outputs[src_port] = profile.blocks[dst_block].inputs[dst_port];
		});

		// Call run
		_.forEach(profile.blocks, function (block, index) {
			if (typeof block.run === 'function') {
				block.run();
			}
		});
	});
}

module.exports = Central;
