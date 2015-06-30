#!/usr/bin/env node

var accessors = require('../accessors');

console.log('Getting random numbers and printing them in color.');


accessors.create_accessor('/webquery/Random', {}, function (err, acc_rand) {
	accessors.create_accessor('/ui/PrintColor', {}, function (err, acc_pcolor) {

		acc_rand.init(function (err) {
			acc_pcolor.init(function (err) {
				function next () {
					acc_rand.read('RandomInteger', function (err, random_val) {
						var hex_string = random_val.toString(16).substring(0, 6);
						acc_pcolor.write('Color', hex_string, function (err) {
							acc_pcolor.write('Text', random_val);
						});
					});
				}

				setInterval(next, 1000);
				next();
			});
		});
	});
});
