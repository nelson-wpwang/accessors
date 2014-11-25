var bulb_layout;

function* prefetch_bulb_layout () {
	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	bulb_layout = JSON.parse(yield* http.readURL(url));
}

function get_bulb_id () {
	var name = get('BulbName');

	for (var key in bulb_layout) {
		if (bulb_layout[key].name == name) {
			return key;
		}
	}
}

function* set_bulb_paramter (params) {
	var bulbid = get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	yield* http.request(url, 'PUT', null, JSON.stringify(params), 3000);
}

function* init () {
	yield* prefetch_bulb_layout();
	var s = '';

	for (var key in bulb_layout) {
		s += bulb_layout[key].name + ', ';
	}
	set('Bulbs', s);
}

function* Power (on) {
	yield* set_bulb_paramter({'on': on});
}

function* Color (color) {
	yield* set_bulb_paramter({'hue': parseInt(color)});
}

function* Brightness (brightness) {
	yield* set_bulb_paramter({'bri': parseInt(brightness)});
}

function* Saturation (sat) {
	yield* set_bulb_paramter({'sat': parseInt(sat)});
}

function* BulbName (name) {
	var bulbid = get_bulb_id();
	if (bulbid) {
		var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid;
		var data = JSON.parse(yield* http.readURL(url));

		set('Power', data.state.on);
		set('Color', data.state.hue);
		set('Brightness', data.state.bri);
		set('Saturation', data.state.sat);
	}
}
