#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/webquery/Bitcoin', {}, function (accessor) {
	accessor.Price.output(function (price) {
		console.log('Current Bitcoin Price: $' + price);

		accessor.Transactions.observe(function (transaction) {
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
		}, function () {}, function (err) {
			console.log(err);
		});
	});
},
// Handle any errors that may occur when creating the accessor.
function (error) {
	console.log('Error loading accessor.');
	console.log(error);
});
