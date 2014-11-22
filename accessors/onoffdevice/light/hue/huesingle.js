var bulbid;

function get_bulb_id () {
	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	var data = JSON.parse(readURL(url));
	var name = get('BulbName');

	for (var key in data) {
		if (data[key].name == name) {
			bulbid = key;
			break;
		}
	}
	return data;
}


function init () {
	var data = get_bulb_id();
	var s = '';

	for (var key in data) {
		s += data[key].name + ', ';
	}
	set('Bulbs', s);

	if (bulbid) {
		var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid;
		var data = JSON.parse(readURL(url));

		set('Power', data.state.on);
		set('Color', data.state.hue);
	}
}

function Power (on) {
	get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	httpRequest(url, 'PUT', null, JSON.stringify({'on': on}), 3000);
}

function Color (color) {
	get_bulb_id();

	url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
	httpRequest(url, 'PUT', null, JSON.stringify({'hue': parseInt(color)}), 3000);
}

function BulbName (name) {
	init();
}

function fire () {

}