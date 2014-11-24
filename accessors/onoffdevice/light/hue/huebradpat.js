function* init () {
	BradHue.set('BulbName', 'Brad');
	PatHue.set('BulbName', 'Pat');

	yield* BradHue.init();
	yield* PatHue.init();
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
