#!/usr/bin/env node

var accessors = require('../accessors');
var oort_flag = 0;
var previous_detect = 0;
var power_count = 0;

var varon;
var vardown;

var parameters = {
	//mac_address: //for pir sensor
	//mac_address: 'c0:98:e5:30:00:91' //for blees
}

function accessor_create_error (err) {
	if (err) {
		console.error('Error loading accessor: ' + err);
		console.error(err);
		return;
	}
}

accessors.create_accessor('/sensor/power/oortSmartSocket', null, function (err, oort) {
	accessor_create_error(err);

	accessors.create_accessor('/sensor/ambient/BLINK', null, function (err, blink) {
			accessor_create_error(err);

		oort.init(function(err) {
			function oorton () {
				//console.log(oort.read('/onoff.Power'));
				oort.write('/onoff.Power', true, function (err) {
					if (err) {
						console.log(err);
						console.log('Waiting for the device to be connected');
						setTimeout(oorton, 1000);
					}
				});
				
			}


			function oortdown () {
			 		oort.write('/onoff.Power', false, function (err) {
			 			if (err) {
			 				console.log('Waiting for the device to turn off');
			 				setTimeout(oortdown, 1000);
			 			}

			 		});
			 	
			}

			blink.init(function(err) {
				console.log('blink init');
				blink.on('Motion_since_last_adv', function (err, data) {
					console.log('Motion from last adv: ' + data);	


					if (data > 0 && oort_flag == 0) {
						console.log('Motion Detected, booting up oort');
						oorton();
						var now_oort = new Date();
						console.log('Oort Time: ' + now_oort);
						oort_flag = 1;
						// continue;
					}

					if (oort_flag == 1){
						 oort.read('/sensor/power.Power', function (err, power){
		 				console.log('Load is drawing: ' + power + 'W');

		 				function powercount () {
		 					power_count += 1;
		 				}

		 			 	if (power < 0.3) {
			 		 		setTimeout(powercount, 0);
			 		 	}
			 		 	if (power_count > 15) {
			 		 		// continue;
			 		 	//}


					

					// }

						setTimeout(oortdown, 1000);
						oort_flag = 0;
						power_count = 0;
					}
			// blink.on('Current_motion', function (err, data) {
			// 	console.log("Current Motion: " + data);
			 			});
					}
			});
		});
	});
});
});

