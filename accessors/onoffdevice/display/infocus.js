// name: InFocus Projector
// author: Pat Pannuto
// email: ppannuto@umich.edu
//
// InFocus Projector Accessor
// ==========================
//
// InFocus makes projectors. This accessor works for the model in our lab (whose
// actual model number is surprisingly difficult to ascertain) and may well work
// for other InFocus projectors.
//

POWER_STATES = {
  'off' : 0,
  'on' : 1,
  'turning_off' : 2,
  'turning_on' : 3
};

SOURCES = {
  'VGA' : 1,
  'HDMI 1' : 2,
  'HDMI 2' : 3,
  'S-Video' : 4,
  'Composite' : 5
};

function* init () {

  var url = get_parameter('device_url') + '/PJState.xml';

  /* Get the XML status from the receiver */
  var xml = yield* rt.http.request(url, 'GET', null, '', 3000);

  val = getXMLValue(xml, 'pjPowermd');
  if ((val == POWER_STATES['off']) || (val == POWER_STATES['turning_off'])) {
    set('Power', false);
  } else {
    set('Power', true);
  }
}

function* Power (power_setting) {
  var url;

  if (power_setting) {
    url = get_parameter('device_url') + '/dpjset.cgi?PJ_PowerMode=1';
  } else {
    url = get_parameter('device_url') + '/dpjset.cgi?PJ_PowerMode=0';
  }
  yield* rt.http.request(url, 'GET', null, '', 3000);
}

function* Input (input_setting_choice) {
  if (SOURCES[input_setting_choice] === undefined) return;

  var url = get_parameter('device_url') + '/dpjset.cgi?PJ_SRCINPUT=' + SOURCES[input_setting_choice];
  yield* rt.http.request(url, 'GET', null, '', 3000);
}

function* fire () {
  yield* Power(get('power'));
  yield* Input(get('input'));
}

function wrapup () {

}

