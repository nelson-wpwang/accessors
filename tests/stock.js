var chai = require('chai');
var expect = chai.expect;

var accessors = require('accessors.io');
accessors.set_host_server('http://localhost:35123');

describe('Tests using StockTick', function () {
	it('should load stocktick', function (done) {
		accessors.create_accessor('/webquery/StockTick', {}, function (err, acc) {
			expect(err).to.equal(null);
			done();
		});
	});

	it('should init stocktick', function (done) {
		accessors.create_accessor('/webquery/StockTick', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc.init(function (err) {
				expect(err).to.equal(null);
				done();
			});
		});
	});

	it('should get stock price', function (done) {
		accessors.create_accessor('/webquery/StockTick', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc.init(function (err) {
				expect(err).to.equal(null);

				acc.write('StockSymbol', 'TSLA', function (err) {
					expect(err).to.equal(null);

					acc.read('Price', function (err, price) {
						expect(err).to.equal(null);
						done();
					});

				});
			});
		});
	});

	it('should get a numeric value', function (done) {
		accessors.create_accessor('/webquery/StockTick', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc.init(function (err) {
				expect(err).to.equal(null);

				acc.write('StockSymbol', 'TSLA', function (err) {
					expect(err).to.equal(null);

					acc.read('Price', function (err, price) {
						expect(err).to.equal(null);
						expect(typeof price).to.equal('number');
						done();
					});

				});
			});
		});
	});

});
