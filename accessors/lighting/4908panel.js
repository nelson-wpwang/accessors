// name:   4908 Panel Lights
// author: Brad Campbell
// email: bradjc@umich.edu

/* Light Control for 4908
 * ======================
 *
 * Use GATD to control the panel lights in 4908.
 */


function* init () {
	provide_interface('/lighting/light', {
		'/onoff/Power': Power
	});
}

function* Power (state) {
	var post_url = get_parameter('post_url');
	var location = get_parameter('location_str');
	var data = {};

	data['light_command'] = (state) ? 'panel_on' : 'panel_off';
	data['location_str'] = location;
	yield* rt.http.request(post_url, 'POST', {'Content-Type': 'application/json'}, JSON.stringify(data), 0);
}
