var BradHue;
var PatHue;

function* init () {

	// Get pointers to the sub-accessors (dependencies)
	BradHue = get_dependency('BradHue');
	PatHue = get_dependency('PatHue');

	// Pretend like we typed in the bulb names that we want to control
	BradHue.set('BulbName', 'Brad');
	PatHue.set('BulbName', 'Pat');

	// Call the functions associated with setting the bulb names.
	// This fetches the current values from the lights
	yield* BradHue.BulbName('Brad');
	yield* PatHue.BulbName('Pat');

	// So the above four lines of code are kinda strange. It's a little odd
	// that you essentially have to set the port twice. It seems like set()
	// on a sub accessor should automatically call the port function, like it
	// does on the web interface.


	// Set our current state if the lights match
	if (BradHue.get('Power') && PatHue.get('Power')) {
		set('Power', true);
	}

	if (BradHue.get('Color') == PatHue.get('Color')) {
		set('Color', PatHue.get('Color'));
	}

	if (BradHue.get('Brightness') == PatHue.get('Brightness')) {
		set('Brightness', PatHue.get('Brightness'));
	}
}

function* Power (on) {
	yield* BradHue.Power(on);
	yield* PatHue.Power(on);
}

function* Color (color) {
	yield* BradHue.Color(color);
	yield* PatHue.Color(color);
}

function* Brightness (bri) {
	yield* BradHue.Brightness(bri);
	yield* PatHue.Brightness(bri);
}
