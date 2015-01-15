// w for "web server"
var request = require('request');
var w = require('express')()
var dir = require('node-dir');

var aruntime = require('./accessors');

w.get('/', function (req, res) {
  res.send('Hello World!');
});

var a = ['/hello', '/hi'];


  for (var i=0; i<a.length; i++) {
  	w.get(a[i], function (req, res) {
  		res.send('woah');
  	});
  }

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

						var path = group_name + '/' + item.name + port.name;
						console.log(path)
						console.log(group.parameters)

						serve[path] = {
							group_name: group_name,
							parameters: item.parameters,
							item_name: item.name,
							item_path: item.path,
							port: port.name
						}

						w.get(path, function (req, res) {
							var p = req.path;
							var item = serve[p];

							// Check if we have already instantiated an
							// accessor for this particular device
							if (!('accessor' in item)) {
								console.log('CREATING ACCESSOr')
								aruntime.create_accessor(item.item_path, item.parameters, function (device) {
									item.accessor = device;

									console.log('USING NEW ACC');
									console.log(item.accessor)

									res.send(item.accessor);
								});
							} else {

								console.log('USING ACCESSSSOOORRRR');
								console.log(item.accessor)

								item.accessor.power(false);

								res.send(item.accessor);
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
