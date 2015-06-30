#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/sensor/power/oortSmartSocket', {}, function (err, oort) {
	if (err) {
		console.log('Error loading accessor.');
		console.log(err);
		return;
	}

	oort.init(function (err) {

		oort.on('/sensor/power.Power', function (err, data) {
			if (err) {
				console.log(err);
			}
			console.log('Load is drawing: ' + data + ' W');
		});

		function wait () {
			oort.write('/onoff.Power', true, function (err) {
				if (err) {
					console.log(err);
					console.log('Waiting for the device to be connected');
					setTimeout(wait, 1000);
				}
			});
		}

		wait();
	});
});
