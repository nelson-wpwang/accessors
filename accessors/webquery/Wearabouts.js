function* init () {
	yield* Update();
}

function* Update () {
	var pid = get_parameter('profile_id');
	var gatd = get_parameter('gatd_url');
	var query = rt.encode.btoa(JSON.stringify({'location_str':get_parameter('location')}));
	var url = gatd + '/viewer/recent/'+pid+'?limit=1&query='+query;

	data = JSON.parse(yield* rt.http.readURL(url));

	if (data.length == 0) {
		set('People', 'Nobody in the room');
	} else {
		people_list = data[0].person_list;
		people_names = [];
		for (var i=0; i<people_list.length; i++) {
			person = people_list[i];
			for (key in person) {
				people_names.push(person[key]);
			}
		}
		if (people_names.length == 0) {
			set('People', 'Nobody in the room');
		} else {
			set('People', people_names.join(', '));
		}
	}
}
