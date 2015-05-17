// name:   4908 Lights
// author: Brad Campbell
// email: bradjc@umich.edu

/* Light Control for 4908
 * ======================
 *
 * All the lights in 4908
 */


var acc_ceiling;
var acc_panel;
var acc_hue;
var acc_lamp;
var acc_sconce;

function* all (state) {
	yield* acc_ceiling.Power(state);
	yield* acc_panel.Power(state);
	yield* acc_hue.Power(state);
	yield* acc_lamp.Power(state);
	yield* acc_sconce.Power(state);
}

function init () {
	create_port('Off', {
		type: "button"
	});

	acc_ceiling = load_dependency('/onoffdevice/light/4908ceiling', get_parameter('gatd_lights'));
	acc_panel = load_dependency('/onoffdevice/light/4908panel', get_parameter('gatd_lights'));
	acc_hue = load_dependency('/onoffdevice/light/hue/allbridgehues', get_parameter('hue_settings'));
	acc_lamp = load_dependency('/onoffdevice/acme++', {'ipv6_address': get_parameter('acme_ip')});
	acc_sconce = load_dependency('/onoffdevice/wemo', {'wemo_url': get_parameter('wemo_url')});
}

Power.input = function* Power () {
	yield* all(state);
}

Off.input = function* () {
	yield* all(false);
}
