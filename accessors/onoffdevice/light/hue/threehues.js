var BradPatHue;
var OtherHue;

function* init () {

	// Get pointers to the sub-accessors (dependencies)
	BradPatHue = get_dependency('BradPatHues');
	OtherHue = get_dependency('OtherHue');
}

function* Power (on) {
	yield* BradPatHue.Power(on);
	yield* OtherHue.Power(on);
}

function* Color (color) {
	yield* BradPatHue.Color(color);
	yield* OtherHue.Color(color);
}

function* Brightness (bri) {
	yield* BradPatHue.Brightness(bri);
	yield* OtherHue.Brightness(bri);
}

function BulbName (name) {
	OtherHue.set(name);
	yield* OtherHue.BulbName(name);

	if (BradBradPatHueHue.get('Power') && OtherHue.get('Power')) {
		set('Power', true);
	}

	if (BradPatHue.get('Color') == OtherHue.get('Color')) {
		set('Color', OtherHue.get('Color'));
	}

	if (BradPatHue.get('Brightness') == OtherHue.get('Brightness')) {
		set('Brightness', OtherHue.get('Brightness'));
	}
}
