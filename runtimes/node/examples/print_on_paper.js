#!/usr/bin/env node

var accessors = require('../accessors');

var printed = false;

accessors.create_accessor('/discovery/mdns-ipp', {}, function (err, ipp) {
	if (err) {
		console.log('Error loading accessor.');
		console.log(err);
		return;
	}

	ipp.on('PrinterURL', function (err, url) {
		console.log('Got printer url: ' + url);

		accessors.create_accessor('/ui/HardCopy', {}, function (err, hc) {
			console.log('Loaded hard copy');
			hc.init(function (err) {
				hc.write('PrinterURL', url, function (err) {
					console.log('Set printer url');
					if (printed == false) {
						printed = true;
						hc.write('String', 'Hello from accessors!');
					}
				});
			});
		});
	});

	ipp.init(function (err) {});
});
