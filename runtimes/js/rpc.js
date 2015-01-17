// w for "web server"
var request = require('request');
var w = require('express')();
var bodyParser = require('body-parser');
var dir = require('node-dir');

var aruntime = require('./accessors');

w.get('/', function (req, res) {
  res.send('Hello World!');
});

w.use(bodyParser.text());

w.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

// var a = ['/hello', '/hi'];


//   for (var i=0; i<a.length; i++) {
//   	w.get(a[i], function (req, res) {
//   		res.send('woah');
//   	});
//   }

// Keep state of all the paths we are serving. Maybe there is a better way
// to do this, but what we are doing is a bit strange given how web servers
// typically work.
var serve = {};

dir.readFiles('../../groups',
              {match: /.json$/,},
              function (err, content, filename, next) {



	// Cut off the '../../groups' part.
	// TODO: make this better
	var group_name = filename.substring(12, filename.length);
	group_name = group_name.substring(0, group_name.length-5);
	console.log(group_name);

	var group = JSON.parse(content);
	// console.log(group);

	w.get(group_name, function (req, res) {
		res.send(group);
	});

	// for each (var accessor in group.accessors) {
	for (var i=0; i<group.accessors.length; i++) {
		var item = group.accessors[i];
		// console.log(accessor);
		// console.log(accessor.path);


		// http.get('http://localhost:6565/accessor'+accessor.path+'.json', function (res) {
		// 	console.log(res);
		// });

		if ('name' in item) {
			// console.log(item.name);
			request('http://localhost:6565/accessor'+item.path+'.json', function (error, response, body) {
				if (!error && response.statusCode == 200) {
					var accessor = JSON.parse(body);
					// console.log(accessor)

					for (var j=0; j<accessor.ports.length; j++) {
						var port = accessor.ports[j];
						console.log(port)

						// console.log(port.name);
						var slash = '';
						if (port.name.substring(0,1) != '/') {
							slash = '/';
						}
						var this_accessor = group_name + '/' + item.name;
						var path = group_name + '/' + item.name + slash + port.name;
						console.log(path)
						console.log(group.parameters)

						serve[this_accessor] = {
							group_name: group_name,
							parameters: item.parameters,
							item_name: item.name,
							item_path: item.path,
							port: port.name,
							port_type: port.type
						}

						w.get(path, function (req, res) {
							var p = req.path;


							// TODO TODO this has to be fixed
							var d = p.split('/');
							var this_accessor = '/' + d[1] + '/' + d[2] + '/' + d[3];
							console.log(this_accessor)

							var item = serve[this_accessor];

							var port = p.split(item.item_name)[1];
							if ((port.match(/\//g) || []).length == 1) {
								port = port.substring(1,port.length);
							}

							console.log('port ' + port)

							console.log(item);

							console.log(item.accessor.ports)


							// Check if we have already instantiated an
							// accessor for this particular device
							if (!('accessor' in item)) {
								console.log('CREATING ACCESSOr')
								aruntime.create_accessor(item.item_path, item.parameters, function (device) {
									item.accessor = device;

									console.log('USING NEW ACC');
									console.log(item.accessor)

									res.send(''+item.accessor.get(port));
								});
							} else {

								// console.log('USING ACCESSSSOOORRRR');
								// console.log(item.accessor);
								// console.log(p);

								// item.accessor.power(false, function () {
								// // TODO: this will break if the name is in the port
								// // or something weird

								res.send(''+item.accessor.get(port));
								// });
							}
						});

						w.post(path, function (req, res) {
							var p = req.path;

							var d = p.split('/');
							var this_accessor = '/' + d[1] + '/' + d[2] + '/' + d[3];

							var item = serve[this_accessor];

							var port = p.split(item.item_name)[1];
							if ((port.match(/\//g) || []).length == 1) {
								port = port.substring(1,port.length);
							}




							// Check if we have already instantiated an
							// accessor for this particular device
							if (!('accessor' in item)) {
								console.log('CREATING ACCESSOr')
								aruntime.create_accessor(item.item_path, item.parameters, function (device) {
									item.accessor = device;

									console.log('USING NEW ACC');
									console.log(item.accessor);

									var arg = null;
									if (item.port_type == 'bool') {
										arg = (req.body == 'true');
									} else {
										arg = req.body;
									}
									

									item.accessor[port](arg, function () {
										res.send('did it');
									});

									
								});
							} else {

								console.log('USING ACCESSSSOOORRRR');
								console.log(item.accessor);
								console.log(p);

								// item.accessor.power(false);

								// TODO: this will break if the name is in the port
								// or something weird
								console.log("IN BODY: " + req.body);

								var arg = null;
								if (item.port_type == 'bool') {
									arg = (req.body == 'true');
								} else {
									arg = req.body;
								}

								item.accessor[port](arg, function () {
									res.send('did it');
								});

							}
						});
					}
				} else {
					console.log('err');
				}
			});

		}
	}


	next();
});

 
var server = w.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);



});
