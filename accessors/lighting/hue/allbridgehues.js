// name: All Hues on a Bridge
// author: Brad Campbell
// email: bradjc@umich.edu
//
// Hue Light Bulbs
// ===============
//
// This controls all of the hues behind a bridge.
//

var bulbids = [];

function* on_each (body) {
	for (var bulbid in bulbids) {
		url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
		yield* rt.http.request(url, 'PUT', null, JSON.stringify(body), 3000);
	}
}

function* init () {
	provide_interface('/lighting/light', {
		'/lighting/light.Power': Power,
	});
	provide_interface('/lighting/hue', {
		'/onoff.Power': Power,
		'/lighting/rgb.Color': Color,
		'/lighting/brightness.Brightness': Brightness
	});

	create_port('output', 'Bridge');

	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	var data = JSON.parse(yield* rt.http.readURL(url));
	var on = false;

	for (var key in data) {
		bulbids.push(key);

		url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + key;
		var bulb_state = JSON.parse(yield* rt.http.readURL(url));
		if (bulb_state.state.on) {
			on = true;
		}
	}
	set('Power', on);

	set('Bridge', get_parameter('bridge_url'));
}

function* Power (on) {
	console.log('power');
	yield* on_each({'on': on});
}

function* Color (hex_color) {
	hsv = rt.color.hex_to_hsv(hex_color);
	params = {'hue': Math.round(hsv.h*182.04),
	          'sat': Math.round(hsv.s*255),
	          'bri': Math.round(hsv.v*255)}
	yield* on_each(params);
}

function* Brightness (brightness) {
	yield* on_each({'bri': parseInt(brightness)});
}

function* SetAll () {
	var power = get('Power');
	var brightness = get('Brightness');
	var color = get('Color');
	var output = {};

	if (color.length) output.hue = parseInt(color);
	if (brightness.length) output.bri = parseInt(brightness);
	output.on = power;

	yield* on_each(output);
}
