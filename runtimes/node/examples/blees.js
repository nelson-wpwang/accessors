#!/usr/bin/env node

var accessors = require('../accessors');

var parameters = {
	mac_address: 'c0:98:e5:30:52:01'
}

accessors.create_accessor('/sensor/ambient/BLEES', parameters, function (err, blees) {
	if (err) {
		console.error('Could not create accessor: ' + err);
		return;
	}
	blees.init(function(err) {
		if (err) {
			console.error('Could not init');
			console.error(err);
			return;
		}

		blees.on('Light', function (err, data) {
			console.log('Light is: ' + data + ' lux');
		});
	});
});
