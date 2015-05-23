#!/usr/bin/env node

/* vim: set noet ts=2 sts=2 sw=2: */

// w for "web server"
try {
	var request = require('request');
	var w = require('express')();
	var bodyParser = require('body-parser');
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


// Check command line arguments
if (argv.host_server == undefined) {
	argv.host_server = 'http://accessors.io';
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

var accessors = require('accessors.io');
accessors.set_host_server(argv.host_server);

// Keep track of all created accessors
var active_accessors = [];

// Setup express
w.use(bodyParser.text());
w.use(bodyParser.json());

// Remove this cross-origin policy nonsense
w.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
  next();
});

// Provide list of accessors
w.get('/list/all', function (req, res) {
	request(argv.host_server + '/list/all', function (error, response, body) {
		res.header("Content-Type", "application/json");
		res.send(body);
	});
});

// Get Accessor IR for an accessor
w.get('/accessor/:path([/\\.\\S]+)', function (req, res) {
	request(argv.host_server + '/accessor/' + req.params.path, function (error, response, body) {
		res.header("Content-Type", "application/json");
		res.send(body);
	});
});

// List all active accessors in this server
w.get('/list/active', function (req, res) {
	res.header("Content-Type", "application/json");
	res.send(JSON.stringify(active_accessors));
});

// List all active accessors in this server
w.get('/device/:name([\\S]+)', function (req, res) {
	res.header("Content-Type", "application/json");

	for (var i=0; i<active_accessors.length; i++) {
		var item = active_accessors[i];

		if (item.name == req.params.name) {
			res.send(JSON.stringify(item.accessor));
			return
		}
	}

	res.send(JSON.stringify({success: 0}));
});

// Create a new accessor
w.post('/create', function (req, res) {
	var create_properties = req.body;

	if (!('path' in create_properties) ||
		!('parameters' in create_properties) ||
		!('custom_name' in create_properties)) {
		res.status(400).send('Malformed accessor creation JSON.');
		return
	}

	accessors.create_accessor(create_properties.path, create_properties.parameters, function (accessor) {
		// Success callback

		active_accessors.push({
			name: create_properties.custom_name,
			path: create_properties.path,
			accessor: accessor._meta
		});

		// Iterate through all ports so we can create routes
		// for all ports.
		accessor._meta.ports.forEach(function (port, port_index, port_array) {
			console.log('Adding port ' + port.name);

			var slash = '';
			if (!s.startsWith(port.name, '/')) {
				slash = '/';
			}
			var port_path = slash + port.name;
			var device_base_path = '/active/' + create_properties.custom_name;
			var device_port_path = device_base_path + port_path;
			console.log('path: ' + device_port_path);

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
				var obj = accessor[export_name];
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
				var obj = accessor[export_name];
				var input_fn = obj.input;

				input_fn(arg, function () {
					res.send('did it');
				});
			});
		});

		res.end('{"success": 1}');
	}, function () {
		// Error callback
		console.log("error creating accessor: " + create_properties.path);
	});


});

// Create the server
var server = w.listen(argv.port);
