
var util    = require('util');
var debug   = require('debug');

var _       = require('lodash');
var async   = require('async');
var asynceo = require('async-each-object');
var uuid    = require('node-uuid');

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
var initialize = require('./blocks/initialize');
var print      = require('./blocks/print');

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
	'Initialize': initialize,
	'Print':      print
}

info = debug('accessorsCentral:info');
error = debug('accessorsCentral:error');

function instantiate_blocks (profile, app_uuid, block_array, global_parameters, done) {

	info('Instantiating blocks with global parameters:');
	info(global_parameters);

	// Create an object for each block
	var calls = [];
	_.forEach(block_array, function (block, index) {

		var params = _.get(block, 'parameters', {});

		if (block.uuid in global_parameters) {
			params = _.extend(params, global_parameters[block.uuid]);
		}

		if (block.type == 'accessor') {
			calls.push(function (callback) {
				profile.blocks[app_uuid+'-'+block.uuid] = new accessor.block(block.path, params, callback);
			});
		} else {
			calls.push(function (callback) {
				// Need to do some checks so we have some idea that what we
				// are doing will work.

				var nblock = block_names[block.type];

				// Check the provided parameters
				for (var parameter_name in _.get(nblock.about, 'parameters', {})) {
					var parameter = nblock.about.parameters[parameter_name];

					// Check that this parameter was provided
					if (!(parameter_name in params)) {
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
				info('Creating block ('+app_uuid+') ' + block.uuid + ' with params:');
				info(params);
				profile.blocks[app_uuid+'-'+block.uuid] = new nblock.block(params, callback);
			});
		}
	});

	async.parallel(calls, done);
}

function connect_blocks (profile, app_uuid, connections, done) {

	info('Connecting blocks for application ' + app_uuid);

	var calls = [];

	// Insert all of the correct calls
	_.forEach(connections, function (conn, index) {
		calls.push(function (callback) {
			var src_block = app_uuid + '-';
			var src_port;
			var dst_block = app_uuid + '-';
			var dst_port;

			var src = conn.src.split('.');
			if (src.length == 2) {
				src_block += src[0];
				src_port = parseInt(src[1]);
				if (isNaN(src_port)) {
					src_port = src[1];
				}
			} else {
				src_block += src[0];
				src_port = 0;
			}

			var dst = conn.dst.split('.');
			if (dst.length == 2) {
				dst_block += dst[0];
				dst_port = parseInt(dst[1]);
				if (isNaN(dst_port)) {
					dst_port = dst[1];
				}
			} else {
				dst_block += dst[0];
				dst_port = 0;
			}

			info('Connecting ('+app_uuid+') ' + conn.src + ' to ' + conn.dst);
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
						info('CENTRAL CONN: calling '+src_block+' ' + profile.blocks[src_block]._connections[src_port].length + ' functions');
						_.forEach(profile.blocks[src_block]._connections[src_port], function (conn, index) {
							conn(arg);
						});
					}
				})(src_block, src_port);
			} else {
				info('DO NOT need to add output function');
			}
			callback();
		});
	});

	async.parallel(calls, done);
}


function instantiate_applications (profile, parameters, profile_desc, done) {
	if (_.get(profile_desc, 'applications', []).length == 0) {
		// If there is nothing to do, just call done.
		// This gets around the nightmare of callbacks
		done();
		return;
	}

	var calls = [];
	_.forEach(profile_desc.applications, function (app, index) {
		calls.push(function (callback) {

			var app_file        = require('./'+app.name+'.json');
			var blocks          = app_file.blocks;
			var connections     = app_file.connections;
			var app_parameters  = _.get(app, 'parameters', {});
			var app_uuid        = uuid.v4();

			// Need to copy all app_parameters to parameters, but need to
			// do so at the sub key level, so we can't just use assign.
			asynceo(app_parameters, function (value, key, a_callback) {
				if (key in parameters) {
					_.assign(parameters[key], value);
				} else {
					parameters[key] = value;
				}
				a_callback();
			},
			function (err) {
				// Continue once we have updated all of the parameters.

				// recurse!
				instantiate_applications(profile, parameters, app_file, function () {
					instantiate_blocks(profile, app_uuid, blocks, parameters, function () {
						// Once done with creating blocks, it's time to connect them
						connect_blocks(profile, app_uuid, connections, callback);
					});
				});
			});
		});
	});

	async.parallel(calls, done);
}




function Central (profile_desc, parameters) {

	var profile = {
		blocks: {},
	}

	// We may have applications
	// var applications = _.get(profile_desc, 'applications', []);

	// info('Top level applications: ' + applications);


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
	instantiate_applications(profile, parameters, profile_desc, function () {

		var app_uuid = uuid.v4();

		// Then load blocks from the top level application
		instantiate_blocks(profile, app_uuid, profile_desc.blocks, config, function () {

			// Then connect the last blocks
			connect_blocks(profile, app_uuid, profile_desc.connections, function () {

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
