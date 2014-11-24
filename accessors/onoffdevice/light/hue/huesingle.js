var bulbid;

function* get_bulb_id () {
	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	var data = JSON.parse(yield* http.readURL(url));
	var name = get('BulbName');

	for (var key in data) {
		if (data[key].name == name) {
			bulbid = key;
			break;
		}
	}
	return data;
}


function* init () {
	var data = yield* get_bulb_id();
	var s = '';

	for (var key in data) {
		s += data[key].name + ', ';
	}
	set('Bulbs', s);

	if (bulbid) {
		var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid;
		var data = JSON.parse(yield* http.readURL(url));

		set('Power', data.state.on);
		set('Color', data.state.hue);
	}
}

function* Power (on) {
	yield* get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	yield* http.request(url, 'PUT', null, JSON.stringify({'on': on}), 3000);
}

function* Color (color) {
	yield* get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	yield* http.request(url, 'PUT', null, JSON.stringify({'hue': parseInt(color)}), 3000);
}

function* BulbName (name) {
	yield* init();
}

function fire () {

}
