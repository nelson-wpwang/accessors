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
		'/lighting/rgb.Color': Color,
		'/lighting/brightness.Brightness': Brightness
	});

	create_port('Bridge');

	// Populate the list of known bulbs
	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	var data = JSON.parse(yield* rt.http.get(url));
	for (var key in data) {
		bulbids.push(key);
	}
}

Power.input = function* (on) {
	yield* on_each({'on': on});
}

Power.output = function* () {
	var on = false;

	for (var bulbid in bulbids) {
		url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + key;
		var bulb_state = JSON.parse(yield* rt.http.get(url));
		if (bulb_state.state.on) {
			on = true;
		}
	}

	return on;
}

Color.input = function* (hex_color) {
	hsv = rt.color.hex_to_hsv(hex_color);
	params = {'hue': Math.round(hsv.h*182.04),
	          'sat': Math.round(hsv.s*255),
	          'bri': Math.round(hsv.v*255)}
	yield* on_each(params);
}

Brightness.input = function* (brightness) {
	yield* on_each({'bri': parseInt(brightness)});
}

Bridge.output = function* () {
	return get_parameter('bridge_url');
}
