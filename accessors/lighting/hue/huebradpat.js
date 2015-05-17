// name: Brad-Pat Hue
// author: Brad Campbell
// email: bradjc@umich.edu
//
// Hue Bulbs for Brad and Pat
// ================================
//
// This is an example of a meta-accessor.
//

var BradHue;
var PatHue;

function* init () {

	var url = get_parameter("bridge_url");
	var uname = get_parameter("username");

	// Get pointers to the sub-accessors (dependencies)
	BradHue = load_dependency('/lighting/hue/huesingle', {bridge_url: url, username: uname, bulb_name: 'Brad'});
	PatHue = load_dependency('/lighting/hue/huesingle', {bridge_url: url, username: uname, bulb_name: 'Pat'});

	provide_interface('/lighting/light', {
			'/lighting/light.Power': Power,
			});
	provide_interface('/lighting/hue', {
			'/lighting/rgb.Color': Color,
			'/lighting/brightness.Brightness': Brightness,
			});
}

Power.input = function* (on) {
	yield* BradHue.Power(on);
	yield* PatHue.Power(on);
}

Color.input = function* (color) {
	yield* BradHue.Color(color);
	yield* PatHue.Color(color);
}

Brightness.input = function* (bri) {
	yield* BradHue.Brightness(bri);
	yield* PatHue.Brightness(bri);
}
