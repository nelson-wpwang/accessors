#!/usr/bin/env node

var accessors = require('../accessors');

accessors.create_accessor('/sensor/power/oortSmartSocket', {}, function (oort) {
	function query () {
		oort.write('Power', true, function () {
			oort.subscribe('Watts', function (data) {
				console.log('Load is drawing: ' + data + ' W');
			}, function () {}, function () {});
		}, function (err) {
			console.log('Waiting for the device to be connected');
			setTimeout(query, 1000);
		});


	}

	query();
},
function (err) {
	console.log('Error loading accessor.');
	console.log(err);
});

// accessors.set_host_server('http://localhost:6565')

// accessors.compile_dev_accessor('/git/accessor-files/accessors/sensor/power/oortSmartSocket.js', function (dev_uuid) {
// 	console.log(dev_uuid)
// 	accessors.get_dev_accessor_ir(dev_uuid, function (accessor_ir) {
// 		accessors.load_accessor(accessor_ir, {}, function (oort) {
// 			function query () {
// 				oort.write('Power', true, function () {
// 					oort.subscribe('Watts', function (data) {
// 						console.log('Load is drawing: ' + data + ' W');
// 					}, function () {}, function () {});
// 				}, function (err) {
// 					console.log('Waiting for the device to be connected');
// 					setTimeout(query, 1000);
// 				});


// 			}

// 			query();
// 		});
// 	});
// },
// function (err) {
// 	console.log('Error loading accessor.');
// 	console.log(err);
// });
