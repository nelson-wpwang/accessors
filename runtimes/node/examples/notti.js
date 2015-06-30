#!/usr/bin/env node

var accessors = require('../accessors');

function getRandomColor() {
    var letters = '0123456789ABCDEF'.split('');
    var color = '';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

accessors.create_accessor('/lighting/notti', {}, function (err, notti) {
	notti.init(function(err) {
		var count = 0;

		function query () {
			count += 1;

			if (count < 5 || count > 11) {
				notti.write('Fade', getRandomColor(), function (err) {
					if (err) {
						console.log('Waiting for the device to be connected: ' + err);
						return;
					}
					console.log('Set fade');
				});

			} else if (count < 10) {
				notti.write('Power', false, function (err) {
					if (err) {
						console.log('Waiting for the device to be connected: ' + err);
						return;
					}
					console.log('Turned off.');
				});

			} else if (count < 12) {
				notti.write('Power', true, function (err) {
					if (err) {
						console.log('Waiting for the device to be connected: ' + err);
						return;
					}
					console.log('Turned on.');
				});
			}

		}

		setInterval(query, 5000);
		query();
	});
});
