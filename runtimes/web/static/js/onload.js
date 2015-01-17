/* vim: set noet ts=2 sts=2 sw=2: */

var devices = [];


$("#group-select").change(function () {
	if ($(this).val() != 0) {
		$("#accessor-interface").text('');
		$.ajax({url: '/group' + $(this).val(),
			success: function (data) {
				if ('status' in data && data['status'] == 'error') {
					alert_error('Unable to load accessors for that group.');

				} else {

					devices = data['devices'];
					$("#accessor-select option[data-temp='true']").remove();

					for (i=0; i<devices.length; i++) {
						$("#accessor-select").append('<option value="'+i+'" data-temp="true">'+devices[i].name+'</option>')
					}
					$("#accessor-select").show();

				}
			}});
	}
}).trigger('change');

$("#accessor-select").change(function () {
	if ($(this).val() != "default") {
		console.log(devices);
		accessor = devices[$(this).val()];
		$("#accessor-interface").html(accessor.html);

		// Activate all sliders
		$('#accessor-'+accessor.uuid+' .slider').each(function () {
			$(this).slider().on('slideStop', function (slide_event) {
				post_accessor(accessor.uuid, $(this).attr('data-port'), slide_event.value);
			});
		});

		// Activate all color pickers
		$('#accessor-'+accessor.uuid+' .colorpicker').colpick({
			flat: true,
			layout: 'hex',
			submit: 0,
			onChange: function (hsb, hex, rgb, el, bySetColor) {
				post_accessor(accessor.uuid, $(this).attr('data-port'), hex);
			}
		});

		// Setup callbacks for buttons and check boxes
		$('#accessor-'+accessor.uuid).on('click', '.accessor-arbitrary-input-button', function () {
			console.log($(this));
			var port = $(this).parents('.port-html-group').find('.port');
			console.log(port);
			post_accessor(accessor.uuid, port.attr('data-port'), port.val());
		});


		$('#accessor-'+accessor.uuid).on('click', '.accessor-get', function () {
			console.log($(this).parents('.port-html-group'));
			var port = $(this).parents('.port-html-group').find('.output-port');
			console.log(port);
			get_accessor(accessor.uuid, port.attr('data-port'));
		});

		$('#accessor-'+accessor.uuid).on('click', '.accessor-checkbox', function () {

			post_accessor(accessor.uuid, $(this).attr('data-port'), $(this).is(':checked'));
		});

		$('#accessor-'+accessor.uuid).on('click', '.accessor-button', function () {
			post_accessor(accessor.uuid, $(this).attr('data-port'), null);
		});

		// init all with GET
	}
});

function post_accessor (uuid, port, arg) {
	var accessor = $('#accessor-'+uuid);
	var device_name = accessor.attr('data-device-name');
	var device_group = accessor.attr('data-device-group');
console.log(accessor_runtime_server);
console.log(device_group);
	// url = accessor_runtime_server + '/' + device_group + '/' + device_name + '/' + port;

	var slash = '';
	if (port.substring(0,1) != '/') {
		slash = '/';
	}

	url = device_group + '/' + device_name + slash + port;



	console.log(url);
	console.log(arg);


	$.post(url, arg);

	var request = $.ajax({
url: url,
type: "POST",
data: arg,
dataType: "text",
contentType:"text/plain"
});

	// Q.spawn(function* () {
	// 	yield* window[accessor_name][accessor_func](arg);
	// });
}

function get_accessor (uuid, port) {
	var accessor = $('#accessor-'+uuid);
	var device_name = accessor.attr('data-device-name');
	var device_group = accessor.attr('data-device-group');
console.log(accessor_runtime_server);
console.log(device_group);
	// url = accessor_runtime_server + '/' + device_group + '/' + device_name + '/' + port;

	var slash = '';
	if (port.substring(0,1) != '/') {
		slash = '/';
	}

	url = device_group + '/' + device_name + slash + port;



	console.log(url);


	$.get(url, function (data) {
		$('#'+port).text(data);
	});
}
