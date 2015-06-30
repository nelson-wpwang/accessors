#!/usr/bin/env node

var accessors = require('../accessors');

console.log('Scrape "google.com" for the contents of the <title> tag.');

function accessor_create_error (err) {
	if (err) {
		console.error('Error loading accessor.');
		console.error(err);
	}
}

accessors.create_accessor('/webquery/TagScraper', {}, function (err, acc_tag) {
	accessor_create_error(err);

	accessors.create_accessor('/ui/Print', {}, function (err, acc_print) {
		accessor_create_error(err);

		acc_tag.init(function (err) {
			acc_print.init(function(err) {
				acc_tag.write('URL', 'http://google.com', function (err) {
					acc_tag.write('Tag', 'title', function (err) {
						acc_tag.read('Scrape', function (err, val) {
							acc_print.write('Print', val);
						});
					});
				});
			});
		});

	});
});
