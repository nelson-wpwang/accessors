#!/usr/bin/env node

var accessors = require('../accessors');

// First step is to create a live "StockTick" accessor. This will execute
// the accessor so we can interact with it.
accessors.create_accessor('/webquery/StockTick', {}, function (accessor) {
	// The StockTick accessor, has two ports: "StockSymbol" and "Price".
	// To get a quote, we first set the StockSymbol port by calling the
	// "input" function on the port.
	accessor.StockSymbol.input('MSFT', function () {
		// After that has been set, we call the "output" function on the
		// Price port to get the current price.
		accessor.Price.output(function (price) {
			console.log('MSFT stock price: $' + price);
		});
	});
},
// Handle any errors that may occur when creating the accessor.
function (error) {
	console.log('Error loading accessor.');
	console.log(error);
});
