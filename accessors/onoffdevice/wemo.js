// name: WeMo
// author: Brad Campbell
// email: bradjc@umich.edu

/* Control WeMo
 * ============
 * WeMo is a WiFi controlled relay device.
 */

var set_body = '<?xml version="1.0" encoding="utf-8"?>\
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\
 <s:Body>\
  <u:SetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">\
   <BinaryState>{binstate}</BinaryState>\
  </u:SetBinaryState>\
 </s:Body>\
</s:Envelope>';

var get_body = '<?xml version="1.0" encoding="utf-8"?>\
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">\
 <s:Body>\
  <u:GetBinaryState xmlns:u="urn:Belkin:service:basicevent:1">\
  </u:GetBinaryState>\
 </s:Body>\
</s:Envelope>';

var url;
var port = null;

function* find_wemo_port () {
	// WeMo ports like to change
	var start_port = 49152;

	for (var i=0; i<5; i++) {
		try {
			var content = yield* rt.http.request(url+':'+(start_port+i)+'/setup.xml', 'GET', null, '', 300);
			port = start_port + i;
			return;
		} catch (err) {
		}
	}
	error('Could not connect to the WeMo. Perhaps it\'s not online?');
}

function* get_power_state () {
	var headers = {}
	headers['SOAPACTION'] = '"urn:Belkin:service:basicevent:1#GetBinaryState"';
	headers['Content-Type'] = 'text/xml; charset="utf-8"';

	var response = yield* rt.http.request(url+':'+port+'/upnp/control/basicevent1', 'POST', headers, get_body, 0);
	var power_state = getXMLValue(response, 'BinaryState');

	set('Power', (parseInt(power_state) == 1));
}

function* set_power_state (state) {
	var headers = {}
	headers['SOAPACTION'] = '"urn:Belkin:service:basicevent:1#SetBinaryState"';
	headers['Content-Type'] = 'text/xml; charset="utf-8"';

	var control = set_body.replace('{binstate}', (state) ? '1' : '0');

	yield* rt.http.request(url+':'+port+'/upnp/control/basicevent1', 'POST', headers, control, 0);
}


function* init () {
	url = get_parameter('wemo_url');

	yield* find_wemo_port();
	yield* get_power_state();
}

function* Power (state) {
	if (port == null) {
		error('WeMo not found. Can not control the relay.');
	}
	yield* set_power_state(state);
}
