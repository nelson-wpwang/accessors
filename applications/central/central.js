
var util = require('util');

var _ = require('lodash');
var async = require('async');

var match      = require('./blocks/match');
var not        = require('./blocks/not');
var delay      = require('./blocks/delay');
var keyway     = require('./blocks/keyway');
var transistor = require('./blocks/transistor');
var filter     = require('./blocks/filter');
var threshold  = require('./blocks/threshold');
var append     = require('./blocks/append');
var constant   = require('./blocks/constant');
var accessor   = require('./blocks/accessor_wrapper');

var block_names = {
	'Match': match,
	'Not': not,
	'Delay': delay,
	'Keyway': keyway,
	'Transistor': transistor,
	'Filter': filter,
	'Threshold': threshold,
	'Append': append,
	'Constant': constant,
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
				if (isNaN(src_port)) {
					src_port = src[1];
				}
			} else {
				src_block = src[0];
				src_port = 0;
			}

			dst = conn.dst.split('.');
			if (dst.length == 2) {
				dst_block = dst[0];
				dst_port = parseInt(dst[1]);
				if (isNaN(dst_port)) {
					dst_port = dst[1];
				}
			} else {
				dst_block = dst[0];
				dst_port = 0;
			}

			console.log('Connecting ' + conn.src + ' to ' + conn.dst);
			if (!_.has(profile.blocks[src_block], '_connections')) {
				// create connections object for block
				profile.blocks[src_block]._connections = {};
			}
			if (!_.has(profile.blocks[src_block]._connections, src_port)) {
				profile.blocks[src_block]._connections[src_port] = [];
			}
			profile.blocks[src_block]._connections[src_port].push(profile.blocks[dst_block].inputs[dst_port]);

			// Create function for the output that calls all the functions in
			// the connections array.
			if (!_.has(profile.blocks[src_block].outputs, src_port)) {
				profile.blocks[src_block].outputs[src_port] = (function (src_block, src_port) {
					return function (arg) {
						console.log('CENTRAL CONN: calling ' + profile.blocks[src_block]._connections[src_port].length + ' functions');
						_.forEach(profile.blocks[src_block]._connections[src_port], function (conn, index) {
							conn(arg);
						});
					}
				})(src_block, src_port);
			}
			// profile.blocks[src_block].outputs[src_port] = profile.blocks[dst_block].inputs[dst_port];
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
