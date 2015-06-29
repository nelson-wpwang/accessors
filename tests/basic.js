var chai = require('chai');
var expect = chai.expect;

var accessors = require('accessors.io');
accessors.set_host_server('http://localhost:6565');

describe('Basic Tests', function () {
	it('should load', function (done) {
		accessors.create_accessor('/ui/Print', {}, function (err, acc) {
			expect(err).to.equal(null);
			done();
		});
	});

	it('should init', function (done) {
		accessors.create_accessor('/ui/Print', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc.init(function (err) {
				expect(err).to.equal(null);
				done();
			});
		});
	});

	it('should write', function (done) {
		accessors.create_accessor('/ui/Print', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc.init(function (err) {
				expect(err).to.equal(null);

				acc.write('Print', 'hello', function (err) {
					expect(err).to.equal(null);
					done();
				});
			});
		});
	});

	it('should auto init', function (done) {
		accessors.create_accessor('/ui/Print', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc.write('Print', 'hello', function (err) {
				expect(err).to.equal(null);
				done();
			});
		});
	});

});
