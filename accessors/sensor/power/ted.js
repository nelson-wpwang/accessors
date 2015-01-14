// name: TED Power Data
// author: Brad Campbell
// email: bradjc@umich.edu
//
// TED Power Data
// ==============
//
// Retrieve data from a TED power meter through GATD.
//

var gatd_url;

function* get_power () {
	data = JSON.parse(yield* rt.http.readURL(gatd_url));

	if (data.length == 0) {
		rt.log.error('Could not get TED data.');
	} else {
		watts = parseFloat(data[0].watts);
		set('CurrentPower', watts);
	}
}

function* init () {

	provide_interface('/sensor/power', {
		'/sensor/power.CurrentPower': CurrentPower
	});

	var pid = get_parameter('profile_id');
	var gatd = get_parameter('gatd_url');
	var query = rt.encode.btoa(JSON.stringify({'location_str':get_parameter('location')}));
	gatd_url = gatd + '/viewer/recent/'+pid+'?limit=1&query='+query;

	yield* get_power();
}

function* fire () {
	yield* get_power();
}
