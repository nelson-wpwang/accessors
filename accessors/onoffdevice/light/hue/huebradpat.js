function* init () {
	BradHue = yield* subinit('BradHue', {BulbName: 'Brad'});
	PatHue = yield* subinit('PatHue', {BulbName: 'Pat'});

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
