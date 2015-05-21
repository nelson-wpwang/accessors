#!/usr/bin/env node

var accessors = require('../../accessors');

accessors.create_accessor('/lighting/colorPage', {post_url:'http://localhost:8765/color'}, function (accessor) {
	var state = false;

	function toggle () {
		if (state) {
			state = false;
		} else {
			state = true;
		}

		accessor.Power.input(state, function () {
			console.log('Successfully toggled the colorPage.');
		}, function (err) {
			console.log('Failed to set the colorPage color.');
		});

		setTimeout(toggle, 1000);
	}

	toggle();

},
// Handle any errors that may occur when creating the accessor.
function (error) {
	console.log('Error loading accessor.');
	console.log(error);
});
