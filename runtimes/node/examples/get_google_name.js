#!/usr/bin/env node

var accessors = require('../accessors');

console.log('Scrape "google.com" for the contents of the <title> tag.');

function accessor_create_error (err) {
	console.log('Error loading accessor.');
	console.log(error);
}

accessors.create_accessor('/webquery/TagScraper', {}, function (acc_tag) {
	accessors.create_accessor('/ui/Print', {}, function (acc_print) {

		acc_tag.URL.input('http://google.com', function () {
			acc_tag.Tag.input('title', function () {
				acc_tag.Scrape.output(function (val) {
					acc_print.Print.input(val);
				});
			});
		});

	}, accessor_create_error);

}, accessor_create_error);
