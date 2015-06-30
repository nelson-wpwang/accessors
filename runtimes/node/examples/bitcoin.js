#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/webquery/Bitcoin', {}, function (err, accessor) {
	if (err) {
		console.log('Error loading accessor.');
		console.log(err);
		return;
	}

	accessor.init(function(err) {
		if (err) {
			console.log('Could not init accessor.');
			console.log(err);
			return;
		}

		accessor.read('Price', function (err, price) {
			if (err) {
				console.log('Some issue contacting the BTC server.');
				return;
			}

			console.log('Current Bitcoin Price: $' + price);
		});

		accessor.on('Transactions', function (err, transaction) {
			console.log('=== Bitcoin Transaction ===');
			for (var i=0; i<transaction.x.inputs.length; i++) {
				var input = transaction.x.inputs[i];
				var addr = input.prev_out.addr;
				var btc = (parseFloat(input.prev_out.value) / 100000000.0).toFixed(6);
				console.log('  FROM ' + addr + '  (' + btc + ' BTC)');
			}

			for (var i=0; i<transaction.x.out.length; i++) {
				var output = transaction.x.out[i];
				var addr = output.addr;
				var btc = (parseFloat(output.value) / 100000000.0).toFixed(6);
				console.log('  TO   ' + addr + '  (' + btc + ' BTC)');
			}

			console.log('');
		});

	});
});
