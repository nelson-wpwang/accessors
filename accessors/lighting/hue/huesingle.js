// name: Hue Single
// author: Brad Campbell
// email: bradjc@umich.edu
//
// Hue Light Bulb
// ==============
//
// This controls a single Hue bulb.
//
//

var bulb_layout;

function* prefetch_bulb_layout () {
	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	rt.log.debug('got here');
	bulb_layout = JSON.parse(yield* rt.http.readURL(url));
	rt.log.debug(bulb_layout);
}

function get_bulb_id () {
	var name = get_parameter('bulb_name');

	for (var key in bulb_layout) {
		if (bulb_layout[key].name == name) {
			return key;
		}
	}
}

function* set_bulb_parameter (params) {
	var bulbid = get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	yield* rt.http.request(url, 'PUT', null, JSON.stringify(params), 3000);
}

function* init () {
	provide_interface('/lighting/light', {
			'/lighting/light.Power': power,
			});
	provide_interface('/lighting/hue', {
			'/lighting/rgb.Color': color,
			'/lighting/brightness.Brightness': brightness,
			});

	create_port('input', 'PCB');

	rt.log.debug("Accessor::hue_single init before prefetch");
	yield* prefetch_bulb_layout();
	rt.log.debug("Accessor::hue_single init after prefetch (end of init)");
}

function* power (on) {
	yield* set_bulb_parameter({'on': on});
}

function* color (hex_color) {
	var hsv = rt.color.hex_to_hsv(hex_color);
	params = {'hue': Math.round(hsv.h*182.04),
	          'sat': Math.round(hsv.s*255),
	          'bri': Math.round(hsv.v*255)}
	yield* set_bulb_parameter(params);
}
function* brightness (brightness) {
	yield* set_bulb_parameter({'bri': parseInt(brightness)});
}

// Control Power, Color, and Brightness in one go.
// Input to the function is an object that looks like:
// {
//   Power: true|false,
//   Color: 'cc5400',
//   Brightness: 120
// }
function* PCB (pcb) {
	var p = pcb.Power;
	var c = pcb.Color;
	var hsv = rt.color.hex_to_hsv(c);
	var b = pcb.Brightness;

	var params = {};
	params['on']  = p;
	params['hue'] = Math.round(hsv.h*182.04);
	params['sat'] = Math.round(hsv.s*255);
	params['bri'] = parseInt(b);

	yield* set_bulb_parameter(params);
}
