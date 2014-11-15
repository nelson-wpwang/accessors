var receiver_url;

function receiver_get_key (xml, key_name) {
	var value = getXMLValue(xml, key_name);
	return value.substring(7, value.length-8);
}

function init () {
  receiver_url = get_parameter('device_url') + '/goform/formMainZone_MainZoneXml.xml?_=1416011630214';

  /* Get the XML from the receiver via the proxy running on the webserver */
  receiver_xml = readURL(receiver_url);

  name = receiver_get_key(receiver_xml, 'FriendlyName');
  set('Name', name);

  power = receiver_get_key(receiver_xml, 'Power') == 'ON';
  set('Power', power);

  volume = parseFloat(receiver_get_key(receiver_xml, 'MasterVolume')) + 80;
  set('Volume', volume);

  input = receiver_get_key(receiver_xml, 'InputFuncSelect');
  if (input == 'THERMAL') {
  	set('Input', 0)
  }

  audio = receiver_get_key(receiver_xml, 'selectSurround');
  if (audio == 'MULTI CH STEREO') {
  	set('AudioMode', 0);
  }
}

function Power (power_setting) {

}

function Volume (volume) {

}

function Input (input_setting_choice) {

}

function wrapup () {

}