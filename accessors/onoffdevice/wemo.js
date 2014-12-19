// name: WeMo
// author: Brad Campbell
// email: bradjc@umich.edu

/* Control WeMo
 * ============
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


function* get_power_state () {
	var headers = {}
	headers['SOAPACTION'] = '"urn:Belkin:service:basicevent:1#GetBinaryState"';
	headers['Content-Type'] = 'text/xml; charset="utf-8"';

	var response = yield* rt.http.request(url+'/upnp/control/basicevent1', 'POST', headers, get_body, 0);
	var power_state = getXMLValue(response, 'BinaryState');

	set('Power', (parseInt(power_state) == 1));
}

function* set_power_state (state) {
	var headers = {}
	headers['SOAPACTION'] = '"urn:Belkin:service:basicevent:1#SetBinaryState"';
	headers['Content-Type'] = 'text/xml; charset="utf-8"';

	var control = set_body.replace('{binstate}', (state) ? '1' : '0');


	yield* rt.http.request(url+'/upnp/control/basicevent1', 'POST', headers, control, 0);
}


function* init () {
	url = get_parameter('wemo_url');

	yield* get_power_state();
}

function* Power (state) {

	yield* set_power_state(state);

}
