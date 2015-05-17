// name:   4908 Lights
// author: Brad Campbell
// email: bradjc@umich.edu

/* Light Control for 4908
 * ======================
 *
 * Use GATD to control the lights in 4908
 */


function* init () {
	provide_interface('/lighting/light', {
		'/onoff/Power': Power
	});
}

Power.input = function* (state) {
	var post_url = get_parameter('post_url');
	var location = get_parameter('location_str');
	var data = {};

	data['light_command'] = (state) ? 'on' : 'off';
	data['location_str'] = location;
	yield* rt.http.request(post_url, 'POST', {'Content-Type': 'application/json'}, JSON.stringify(data), 0);
}
