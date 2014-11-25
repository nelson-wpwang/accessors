function* init () {
	BradHue.set('BulbName', 'Brad');
	PatHue.set('BulbName', 'Pat');

	yield* BradHue.init();
	yield* PatHue.init();

	yield* BradHue.BulbName('Brad');
	yield* PatHue.BulbName('Pat');

	if (BradHue.get('Power') && PatHue.get('Power')) {
		set('Power', true);
	}

	if (BradHue.get('Color') == PatHue.get('Color')) {
		set('Color', PatHue.get('Color'));
	}

	if (BradHue.get('Brightness') == PatHue.get('Brightness')) {
		set('Brightness', PatHue.get('Brightness'));
	}

	if (BradHue.get('Saturation') == PatHue.get('Saturation')) {
		set('Saturation', PatHue.get('Saturation'));
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

function* Saturation (sat) {
	yield* BradHue.Saturation(sat);
	yield* PatHue.Saturation(sat);
}
