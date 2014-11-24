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

function* init () {
	yield* prefetch_bulb_layout();
	var s = '';

	for (var key in bulb_layout) {
		s += bulb_layout[key].name + ', ';
	}
	set('Bulbs', s);
}

function* Power (on) {
	var bulbid = get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	yield* http.request(url, 'PUT', null, JSON.stringify({'on': on}), 3000);
}

function* Color (color) {
	var bulbid = get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	yield* http.request(url, 'PUT', null, JSON.stringify({'hue': parseInt(color)}), 3000);
}

function* BulbName (name) {
	var bulbid = get_bulb_id();
	if (bulbid) {
		var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid;
		var data = JSON.parse(yield* http.readURL(url));

		set('Power', data.state.on);
		set('Color', data.state.hue);
	}
}
