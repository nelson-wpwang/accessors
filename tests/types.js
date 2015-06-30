var chai = require('chai');
var expect = chai.expect;

var accessors = require('accessors.io');
accessors.set_host_server('http://localhost:35123');

describe('Type Tests', function () {
	it('should get string', function (done) {
		accessors.create_accessor('/tests/port-types', {}, function (err, acc) {
			expect(err).to.equal(null);
			acc.init(function(err) {
				acc.read('str', function (err, v) {
					expect(err).to.equal(null);
					expect(typeof v).to.equal('string');
					done();
				});
			});
		});
	});

	it('should get integer', function (done) {
		accessors.create_accessor('/tests/port-types', {}, function (err, acc) {
			expect(err).to.equal(null);
			acc.read('int', function (err, v) {
				expect(err).to.equal(null);
				expect(typeof v).to.equal('number');
				done();
			});
		});
	});

	it('should get float', function (done) {
		accessors.create_accessor('/tests/port-types', {}, function (err, acc) {
			expect(err).to.equal(null);
			acc.read('num', function (err, v) {
				expect(err).to.equal(null);
				expect(typeof v).to.equal('number');
				done();
			});
		});
	});

	it('should get color error', function (done) {
		accessors.create_accessor('/tests/port-types', {}, function (err, acc) {
			expect(err).to.equal(null);
			acc.read('col', function (err, v) {
				expect(err).not.to.be.null;
				done();
			});
		});
	});

	it('should get bool', function (done) {
		accessors.create_accessor('/tests/port-types', {}, function (err, acc) {
			expect(err).to.equal(null);
			acc.read('bool', function (err, v) {
				expect(err).to.equal(null);
				expect(typeof v).to.equal('boolean');
				done();
			});
		});
	});
});
