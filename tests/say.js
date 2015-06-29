var chai = require('chai');
var expect = chai.expect;

var accessors = require('accessors.io');
accessors.set_host_server('http://localhost:35123');

describe('Say', function () {
	it('should run, and theoretically speak something', function () {
		accessors.create_accessor('/ui/Say', {}, function (err, acc) {
			expect(err).to.equal(null);

			acc_tag.write('Say', 'Hello', function (err) {
				expect(err).to.equal(null);
			});
		});
	});
});
