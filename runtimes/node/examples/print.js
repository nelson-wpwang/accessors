#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/ui/Print', {}, function (err, acc_print) {
	acc_print.init(function (err) {
		acc_print.write('Print', 'The "Print" accessor works!');
	});
});

