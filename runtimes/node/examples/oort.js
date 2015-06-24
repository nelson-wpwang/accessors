#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/sensor/power/oortSmartSocket', {}, function (err, oort) {
	if (err) {
		console.log('Error loading accessor.');
		console.log(err);
		return;
	}

	oort.init(function (err) {

		oort.on('Watts', function (err, data) {
			console.log('Load is drawing: ' + data + ' W');
		});

		function wait () {
			oort.write('Power', true, function (err) {
				if (err) {
					console.log('Waiting for the device to be connected');
					setTimeout(wait, 1000);
				}
			});
		}

		wait();
	});
});
