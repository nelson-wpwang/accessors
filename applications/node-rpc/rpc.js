#!/usr/bin/env node

/* vim: set noet ts=2 sts=2 sw=2: */

// w for "web server"
try {
	var request = require('request');
	var w = require('express')();
	var bodyParser = require('body-parser');
	var dir = require('node-dir');
	var s = require('underscore.string');

	var argv = require('optimist')
		.usage('Run an accessor with a command line interface.\nUsage: $0')
		.alias('s', 'host_server')
		.describe('s', 'URL of the accessor host server to use.')
		.argv;
} catch (e) {
	console.log("** Missing import in the node-rpc library");
	console.log("** This is an error with the node-rpc module.");
	throw e;
}



var GROUP_FOLDER = '../../groups'

// Check command line arguments
if (argv.host_server == undefined) {
	argv.host_server = 'http://accessors.io:6565';
	console.log('Using default Accessor Host Server: ' + argv.host_server);
	console.log('To specify, use option --host_server');
} else {
	if (argv.host_server.slice(0, 7) != 'http://') {
		argv.host_server = 'http://' + argv.host_server;
	}
	console.log('Using Accessor Host Server: ' + argv.host_server);
}
if (argv.port == undefined) {
	argv.port = 5577;
	console.log('Using default port for RPC commands: ' + argv.port);
	console.log('To specify, use option --port');
} else {
	console.log('Using port ' + argv.port + ' for RPC commands');
}

var aruntime = require('accessors');
aruntime.set_host_server(argv.host_server);

// Setup express
w.use(bodyParser.text());

// Remove this cross-origin policy nonsense
w.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

// Keep state of all the paths we are serving. Maybe there is a better way
// to do this, but what we are doing is a bit strange given how web servers
// typically work.
// var serve = {};

// Load all groups and all of the accessors in those groups.
// Match all JSON files in the groups folder
dir.readFiles('../../groups',
              {match: /.json$/,},
              function (err, content, filename, next) {

	// Cut off the '../../groups' part.
	var group_name = s.strRight(filename, '../../groups');
	// Cut off the '.json' part.
	group_name = s.strLeft(group_name, '.json');

	console.log('Adding group: ' + group_name);

	// Load the actual group listing
	var group = JSON.parse(content);

	// Create a route for retrieving all of the group information
	w.get(group_name, function (req, res) {
		console.log("GET " + group_name + ": (req: %j, res: %j)", req, res);
		res.send(group);
	});

	// Iterate through all accessors in the group and create paths for their ports
	group.accessors.forEach(function (new_device, index, device_array) {
	// for (var i=0; i<group.accessors.length; i++) {
		// var new_device = group.accessors[i];

		if (!('name' in new_device)) {
			console.log('Skipping accessor for ' + new_device.path + ' because it is not named.');
			return;
		}

		// Retrieve the full accessor from the host server
		var accessor_url = argv.host_server + '/accessor' + new_device.path+'.json';
		var device_base_path = group_name + '/' + new_device.name;

		request(accessor_url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var accessor = JSON.parse(body);

				console.log('Adding accessor ' + accessor.name + ' for ' + new_device.name);

				// Generate an object for the accessor that we can actually
				// call and execute.
				aruntime.create_accessor(new_device.path, new_device.parameters, function (accessor_runtime) {
					// Success callback


					// Iterate through all ports so we can create routes
					// for all ports.
					accessor.ports.forEach(function (port, port_index, port_array) {
						console.log('Adding port ' + port.name);

						var slash = '';
						if (!s.startsWith(port.name, '/')) {
							slash = '/';
						}
						var port_path = slash + port.name;
						var device_port_path = device_base_path + port_path;
						console.log(device_port_path);

						// Save information about this particular device in a
						// global structure so we can keep track of it when
						// we get requests.
						// var device_info = {
						// 	group_name: group_name,
						// 	parameters: new_device.parameters,
						// 	item_name:  new_device.name,
						// 	item_path:  new_device.path,
						// 	port:       port.name,
						// 	port_type:  port.type,
						// 	port_path:  port_path
						// };

						// Handle GET requests for this port
						w.get(device_port_path, function (req, res) {
							console.log(" GET " + device_port_path + ": (req: " + req + ", res: " + res + ")");
							if (port.directions.indexOf('output') == -1) {
								res.status(404).send('Request for output when that is not a valid direction');
								return
							}
							var func = port.function;
							var export_name = func.replace(/\./g, '_');
							var obj = accessor_runtime[export_name];
							var output_fn = obj.output;
							output_fn(function (result) {
								console.log(" --> resp: " + result);
								res.send(''+result);
							});
						});

						w.post(device_port_path, function (req, res) {
							console.log("POST " + device_port_path + ": (req: " + req + ", res: " + res + ")");
							if (port.directions.indexOf('input') == -1) {
								res.status(404).send('Request for input when that is not a valid direction');
								return
							}
							var arg = null;
							if (port.type == 'bool') {
								console.log('REQ BODY: ' + req.body);
								arg = (req.body == 'true');
							} else {
								arg = req.body;
							}

							var func = port.function;
							var export_name = func.replace(/\./g, '_');
							var obj = accessor_runtime[export_name];
							var input_fn = obj.input;

							input_fn(arg, function () {
								res.send('did it');
							});
						});
					});
				}, function () {
					// Error callback
					console.log("error creating accessor: " + accessor_url);
				});
			} else {
				console.log("error requesting accessor: " + accessor_url);
				console.log(error);
			}
		});
	});

	next();
});

// Create the server
var server = w.listen(argv.port);
