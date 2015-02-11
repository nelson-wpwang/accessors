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
						$("#accessor-select").append('<option value="'+i+'" data-temp="true">'+devices[i].name+' - '+devices[i].device_name+'</option>')
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
				post_accessor(accessor.uuid, $(this).attr('id'), slide_event.value);
			});
		});

		// Activate all color pickers
		$('#accessor-'+accessor.uuid+' .colorpicker').colpick({
			flat: true,
			layout: 'hex',
			submit: 0,
			onChange: function (hsb, hex, rgb, el, bySetColor) {
				post_accessor(accessor.uuid, $(this).attr('id'), hex);
			}
		});

		// Setup callbacks for buttons and check boxes
		$('#accessor-'+accessor.uuid).on('click', '.accessor-arbitrary-input-button', function () {
			var port = $(this).parents('.port-html-group').find('.port');
			post_accessor(accessor.uuid, port.attr('id'), port.val());
		});


		$('#accessor-'+accessor.uuid).on('click', '.accessor-get', function () {
			var port = $(this).parents('.port-html-group').find('.output-port');
			get_accessor(accessor.uuid, port.attr('id'));
		});

		$('#accessor-'+accessor.uuid).on('click', '.accessor-checkbox', function () {
			post_accessor(accessor.uuid, $(this).attr('id'), $(this).is(':checked'));
		});

		$('#accessor-'+accessor.uuid).on('click', '.accessor-button', function () {
			post_accessor(accessor.uuid, $(this).attr('id'), null);
		});

		// init all with GET
		for (var i=0; i<accessor.ports.length; i++) {
			get_accessor(accessor.uuid, accessor.ports[i].uuid, accessor.ports[i].type);
		}
	}
});

function post_accessor (uuid, port_uuid, arg) {
	var accessor = $('#accessor-'+uuid);
	var device_name = accessor.attr('data-device-name');
	var device_group = accessor.attr('data-device-group');

	if (port_uuid.indexOf('port-') == 0) {
		port_uuid = port_uuid.substring(5, port_uuid.length);
	}
	var port = $('#port-'+port_uuid);
	var port_name = port.attr('data-port');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	url = device_group + '/' + device_name + slash + port_name;

	// Force arg to be a string
	arg = '' + arg;

	// Issue the POST request
	var request = $.ajax({
		url: url,
		type: "POST",
		data: arg,
		dataType: "text",
		contentType:"text/plain"
	});
}

function get_accessor (uuid, port_uuid, port_type) {
	var accessor = $('#accessor-'+uuid);
	var device_name = accessor.attr('data-device-name');
	var device_group = accessor.attr('data-device-group');

	if (port_uuid.indexOf('port-') == 0) {
		port_uuid = port_uuid.substring(5, port_uuid.length);
	}
	var port = $('#port-'+port_uuid);
	var port_name = port.attr('data-port');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	url = device_group + '/' + device_name + slash + port_name;

	console.log('Get: ' + url);
	$.get(url, function (data) {
		console.log(data);
		if (port_type == 'output') {
			port.text(data);
		} else if (port_type == 'bool') {
			port.prop('checked', data=='true');
		} else if (port_type == 'select') {
			port.val(data);
		} else if (port_type == 'color') {
			port.colpickSetColor('#'+data, true);
		} else if (port.hasClass('slider')) {
			port.slider('setValue', parseFloat(data));
		} else {
			port.val(data);
		}
	});
}
