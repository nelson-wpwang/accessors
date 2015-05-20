var accessors = require('../accessors');

accessors.create_accessor('/webquery/StockTick', {}, function (accessor) {
	// Set the stock symbol we want to query
	accessor.StockSymbol.input('MSFT', function () {
		accessor.Price.output(function (price) {
			console.log('MSFT stock price: $' + price);
		});
	});
});