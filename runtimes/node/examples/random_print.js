#!/usr/bin/env node

var accessors = require('../accessors');

console.log('Getting random numbers and printing them in color.');

function accessor_create_error (err) {
	console.log('Error loading accessor.');
	console.log(error);
}

accessors.create_accessor('/webquery/Random', {}, function (acc_rand) {
	accessors.create_accessor('/ui/PrintColor', {}, function (acc_pcolor) {

		function next () {
			acc_rand.RandomInteger.output(function (random_val) {
				var hex_string = random_val.toString(16).substring(0, 6);
				acc_pcolor.Color.input(hex_string, function () {
					acc_pcolor.Text.input(random_val);
				});
			});

			setTimeout(next, 1000);
		}

		next();

	}, accessor_create_error);

}, accessor_create_error);
