// w for "web server"
var request = require('request');
var w = require('express')();
var bodyParser = require('body-parser');
var dir = require('node-dir');
var argv = require('optimist').argv;
var s = require('underscore.string');

var aruntime = require('../../runtimes/node/accessors');

var GROUP_FOLDER = '../../groups'

// Check command line arguments
if (argv.host_server == undefined) {
	console.log('Must define --host_server');
	process.exit(1);
}
if (argv.port == undefined) {
	console.log('Must define --port');
	process.exit(1);
}

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
		res.send(group);
	});

	// Iterate through all accessors in the group and create paths for their ports
	group.accessors.forEach(function (new_device, index, device_array) {
	// for (var i=0; i<group.accessors.length; i++) {
		// var new_device = group.accessors[i];

		if (!('name' in new_device)) {
			console.log('Skipping device because it is not named.');
			continue;
		}

		// Retrieve the full accessor from the host server
		var accessor_url = argv.host_server + '/accessor' + new_device.path+'.json';
		var device_base_path = group_name + '/' + new_device.name;

		request(accessor_url, function (error, response, body) {
			if (!error && response.statusCode == 200) {
				var accessor = JSON.parse(body);

				console.log('Adding accessor ' + accessor.name);

				// Generate an object for the accessor that we can actually
				// call and execute.
				aruntime.create_accessor(new_device.path, new_device.parameters, function (accessor_runtime) {

					// Iterate through all ports so we can create routes
					// for all ports.
					accessor.ports.forEach(function (port, port_index, port_array) {
					// for (var j=0; j<accessor.ports.length; j++) {
						// var port = accessor.ports[j];

						console.log('Adding port ' + port.name);

						var slash = '';
						if (!s.startsWith(port.name, '/')) {
							slash = '/';
						}
						var port_path = slash + port.name;
						var device_port_path = device_base_path + port_path;

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
							// var device_info = device_info;


							// Check if we have already instantiated an
							// accessor for this particular device
							// if (!('accessor' in item)) {
							// 	console.log('CREATING ACCESSOr')
							// 	aruntime.create_accessor(item.item_path, item.parameters, function (device) {
							// 		item.accessor = device;

							// 		console.log('USING NEW ACC');
							// 		console.log(item.accessor)

							// 		res.send(''+item.accessor.get(port));
							// 	});
							// } else {

								// console.log('USING ACCESSSSOOORRRR');
								// console.log(item.accessor);
								// console.log(p);

								// item.accessor.power(false, function () {
								// // TODO: this will break if the name is in the port
								// // or something weird

							res.send(''+accessor_runtime.get(port));
								// });
							// }
						});

						w.post(path, function (req, res) {
							// var p = req.path;

							// var d = p.split('/');
							// var this_accessor = '/' + d[1] + '/' + d[2] + '/' + d[3];

							// var item = serve[this_accessor];

							// var port = p.split(item.item_name)[1];
							// if ((port.match(/\//g) || []).length == 1) {
							// 	port = port.substring(1,port.length);
							// }




							// Check if we have already instantiated an
							// accessor for this particular device
							// if (!('accessor' in item)) {
							// 	console.log('CREATING ACCESSOr')
							// 	aruntime.create_accessor(item.item_path, item.parameters, function (device) {
							// 		item.accessor = device;

							// 		console.log('USING NEW ACC');
							// 		console.log(item.accessor);

							var arg = null;
							if (port.type == 'bool') {
								arg = (req.body == 'true');
							} else {
								arg = req.body;
							}
									

							accessor_runtime[port.name](arg, function () {
								res.send('did it');
							});

									
							// 	});
							// } else {

							// 	console.log('USING ACCESSSSOOORRRR');
							// 	console.log(item.accessor);
							// 	console.log(p);

							// 	// item.accessor.power(false);

							// 	// TODO: this will break if the name is in the port
							// 	// or something weird
							// 	console.log("IN BODY: " + req.body);

							// 	var arg = null;
							// 	if (item.port_type == 'bool') {
							// 		arg = (req.body == 'true');
							// 	} else {
							// 		arg = req.body;
							// 	}

							// 	item.accessor[port](arg, function () {
							// 		res.send('did it');
							// 	});

							// }
						});
					});
				});
			} else {
				console.log('err');
			}
		});

	});

	next();
});

// Create the server
var server = w.listen(argv.port);
