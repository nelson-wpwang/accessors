// name: Three Hues
// author: Brad Campbell
// email: bradjc@umich.edu
//
// Three Hues Accessor
// ===================
//
// This accessors controls Brad, Pat, and a third hue. It is basically a test
// of nested accessors.

var BradPatHue;
var OtherHue;

function* init () {
	create_port('input', 'BulbName');

	var hue_config = get_parameter("hue_config");
	var params = {
		hue_config: hue_config
	};

	// Get pointers to the sub-accessors (dependencies)
	BradPatHue = load_dependency('/onoffdevice/light/hue/huebradpat', params);
	OtherHue = load_dependency('/onoffdevice/light/hue/huesingle', hue_config);

	OtherHue.set('BulbName', 'Spare 1');
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
