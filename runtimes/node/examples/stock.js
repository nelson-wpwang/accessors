#!/usr/bin/env node

var accessors = require('../accessors');

// First step is to create a live "StockTick" accessor. This will execute
// the accessor so we can interact with it.
accessors.create_accessor('/webquery/StockTick', {}, function (err, accessor) {
	if (err) {
		// Handle any errors that may occur when creating the accessor.
		console.log('Error loading accessor.');
		console.log(error);
		return;
	}

	// To use an accessor we must call init()
	accessor.init(function (err) {
		// The StockTick accessor, has two ports: "StockSymbol" and "Price".
		// To get a quote, we first set the StockSymbol port by writing the
		// port.
		accessor.write('StockSymbol', 'MSFT', function (err) {
			// After that has been set, we read the Price port to get
			// the current price.
			accessor.read('Price', function (err, price) {
				console.log('MSFT stock price: $' + price);
			});
		});
	});
});