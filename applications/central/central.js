
var util  = require('util');
var debug = require('debug');

var _     = require('lodash');
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
	'Match':      match,
	'Not':        not,
	'Delay':      delay,
	'Keyway':     keyway,
	'Transistor': transistor,
	'Filter':     filter,
	'Threshold':  threshold,
	'Append':     append,
	'Constant':   constant,
}

error = debug('accessorsCentral:error');


function instantiate_blocks (profile, block_array, global_parameters, done) {

	// Create an object for each block
	var calls = [];
	_.forEach(block_array, function (block, index) {

		if (block.uuid in global_parameters) {
			var params = _.extend(block.parameters, global_parameters[block.uuid]);
		} else {
			var params = block.parameters;
		}

		if (block.type == 'accessor') {
			calls.push(function (callback) {
				profile.blocks[block.uuid] = new accessor(block.path, params, callback);
			});
		} else {
			calls.push(function (callback) {
				// Need to do some checks so we have some idea that what we
				// are doing will work.

				var nblock = block_names[block.type];

				// Check the provided parameters
				for (var parameter_name in nblock.about.parameters) {
					var parameter = nblock.about.parameters[parameter_name];

					// Check that this parameter was provided
					if (!(parameter_name in params) {
						throw 'Missing parameter "' + parameter_name + '" for block ' + nblock.about.name;
					}

					// If useful, check that parameter is the correct type
					if (_.isPlainObject(parameter)) {
						if (parameter.type == 'string_array') {
							// This parameter should look like
							//   ['abc', 'def']
							if (!_.isArray(params[parameter_name])) {
								throw 'Parameter "' + parameter_name + '" is the wrong type';
							} else {
								for (var i=0; i<params[parameter_name].length; i++) {
									var arr_val = params[parameter_name][i];
									if (!_.isString(arr_val)) {
										throw 'Parameter "' + parameter_name + '" does not only contain strings';
									}
								}
							}
						
						} else if (parameter.type == 'keyvalue_array') {
							// This parameter should look like
							//   [['key1', value1], ['key2', value2]]
							if (!_.isArray(params[parameter_name])) {
								throw 'Parameter "' + parameter_name + '" is the wrong type';
							} else {
								for (var i=0; i<params[parameter_name].length; i++) {
									var arr_val = params[parameter_name][i];
									if (!_.isArray(arr_val)) {
										throw 'Parameter "' + parameter_name + '" does not only contain arrays';
									}
									if (arr_val.length != 2) {
										throw 'Parameter "' + parameter_name + '" items must be length 2';
									}
									if (!_.isString(arr_val[0])) {
										throw 'Parameter "' + parameter_name + '" items must start with string';
									}
								}
							}
						}
					}

				}

				// Create the actual block
				profile.blocks[block.uuid] = new nblock(params, callback);
			});
		}
	});

	async.parallel(calls, done);
}

function connect_blocks (profile, connections, done) {

	var calls = [];

	// Insert all of the correct calls
	_.forEach(connections, function (conn, index) {
		calls.push(function (callback) {
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
			callback();
		});
	});

	async.parallel(calls, done);
}


function instantiate_applications (profile, applications, done) {
	if (applications.length == 0) {
		// If there is nothing to do, just call done.
		// This gets around the nightmare of callbacks
		done();
		return;
	}

	var calls = [];
	_.forEach(profile_desc.applications, function (app, index) {
		calls.push(function (callback) {

			var app_file = require(app.name);
			var blocks = app_file.profile_desc.blocks;
			var connections = app_file.profile_desc.connections;
			var parameters = _.get(app, 'parameters', {});
			var subapplications = _.get(app_file.profile_desc, 'applications', []);
			
			// recurse!
			instantiate_applications(profile, subapplications, function () {
				instantiate_blocks(profile, blocks, parameters, function () {
					// Once done with creating blocks, it's time to connect them
					connect_blocks(profile, connections, callback);
				});
			});
		})
	}

	async.parallel(calls, done);
}




function Central (profile_desc) {

	var profile = {
		blocks: {},
	}

	// We may have applications
	var applications = _.get(profile_desc, 'applications', []);


	/*
	 * I long for thee javascript, when thou decides that the suffering
	 * shall end, that the programmers shall be spared, and that a new day
	 * is upon us. When thou decrees loudly and widely and forcefully:
	 * "Nested callbacks shall be a necessary demon no more!"
	 * And whence this time comes, and we are all saved, a new language
	 * will come forth:
	 * 
	 * await instantiate_applications(profile, applications);
	 * await instantiate_blocks(profile, profile_desc.blocks, {});
	 * await connect_blocks(profile, profile_desc.connections);
	 */

	// Start by loading the blocks from any included applications
	instantiate_applications(profile, applications, function () {

		// Then load blocks from the top level application
		instantiate_blocks(profile, profile_desc.blocks, {}, function () {

			// Then connect the last blocks
			connect_blocks(profile, profile_desc.connections, function () {

				// Then call any run commands to get things kickin'
				_.forEach(profile.blocks, function (block, index) {
					if (typeof block.run === 'function') {
						block.run();
					}
				});

			});
		});
	});

		
}

module.exports = Central;
