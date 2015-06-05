#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/sensor/ambient/BLEES', {}, function (blees) {
	blees.Light.observe(function (data) {
		console.log('Light is: ' + data + ' lux');
	}, function () {}, function () {});
},
function (err) {
	console.log('Error loading accessor.');
	console.log(err);
});

// accessors.compile_dev_accessor('~/git/accessor-files/accessors/sensor/ambient/BLEES.js', function (dev_uuid) {
// 	accessors.get_dev_accessor_ir(dev_uuid, function (accessor_ir) {
// 		accessors.load_accessor(accessor_ir, {mac_address: 'c0:98:e5:30:da:e4'}, function (blees) {
// 			oort.Light.observe(function (blees) {
// 				console.log('Light is: ' + data + ' lux');
// 			}, function () {}, function () {});
// 		});
// 	});
// },
// function (err) {
// 	console.log('Error loading accessor.');
// 	console.log(err);
// });
