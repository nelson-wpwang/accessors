#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/ui/Print', {}, function (acc_print) {
	acc_print.write('Print', 'The "Print" accessor works!');
},
function (err) {
	console.log('Error loading accessor.');
	console.log(error);
});

