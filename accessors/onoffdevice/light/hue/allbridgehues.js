var bulbids = [];

function on_each (body) {
	for (var bulbid in bulbids) {
		url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + bulbid + '/state';
		httpRequest(url, 'PUT', null, JSON.stringify(body), 3000);
	}
}

function init () {
	var url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights';
	var data = JSON.parse(readURL(url));
	var on = false;

	for (var key in data) {
		bulbids.push(key);

		url = get_parameter('bridge_url') + '/api/' + get_parameter('username') + '/lights/' + key;
		var bulb_state = JSON.parse(readURL(url));
		if (bulb_state.state.on) {
			on = true;
		}
	}
	set('Power', on);

	set('Bridge', get_parameter('bridge_url'));
}

function Power (on) {
	on_each({'on': on});
}

function Color (color) {
	on_each({'hue': parseInt(color)});
}

function Brightness (brightness) {
	on_each({'bri': parseInt(brightness)});
}

function SetAll () {
	var power = get('Power');
	var brightness = get('Brightness');
	var color = get('Color');
	var output = {};

	if (color.length) output.hue = parseInt(color);
	if (brightness.length) output.bri = parseInt(brightness);
	output.on = power;

	on_each(output);
}

function fire () {

}