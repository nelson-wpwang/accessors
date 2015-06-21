#!/usr/bin/env node

var accessors = require('../accessors');
accessors.set_host_server('http://localhost:6565')

var printed = false;

accessors.create_accessor('/discovery/mdns-ipp', {}, function (ipp) {

	ipp.read('PrinterURL', function (url) {
		console.log('Got printer url: ' + url);

		accessors.create_accessor('/ui/HardCopy', {}, function (hc) {
			console.log('Loaded hard copy');
			hc.write('PrinterURL', url, function () {
				console.log('Set printer url');
				if (printed == false) {
					printed = true;
					hc.write('String', 'Hello from accessors!');
				}
			});
		});
	});
},
function (err) {
	console.log('Error loading accessor.');
	console.log(err);
});
