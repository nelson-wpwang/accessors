#!/usr/bin/env node

var chai = require('chai');
var expect = chai.expect;

var accessors = require('accessors.io');
accessors.set_host_server('http://localhost:35123');


describe('TagScraper', function () {
	it('should get Google', function (done) {
		accessors.create_accessor('/webquery/TagScraper', {}, function (err, acc_tag) {
			expect(err).to.equal(null);

			acc_tag.write('URL', 'http://google.com', function (err) {
				expect(err).to.equal(null);
				acc_tag.write('Tag', 'title', function (err) {
					expect(err).to.equal(null);
					acc_tag.read('Scrape', function (err, val) {
						expect(err).to.equal(null);
						expect(val).to.equal('Google');
						done();
					});
				});
			});
		});
	});

	it('should give error, cannot read write-only port', function (done) {
		accessors.create_accessor('/webquery/TagScraper', {}, function (err, acc_tag) {
			expect(err).to.equal(null);

			acc_tag.write('URL', 'http://google.com', function (err) {
				expect(err).to.equal(null);
				acc_tag.read('URL', function (err, val) {
					expect(err).not.to.equal(null);
					done();
				});
			});
		});
	});
});
