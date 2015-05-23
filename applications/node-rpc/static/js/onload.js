/* vim: set noet ts=2 sts=2 sw=2: */

var devices = {};

$("#accessor-select").change(function () {
	if ($(this).val() != 'default') {
		$("#accessor-new form").html('');
		var path = $(this).val();
		$.ajax({url: '/accessor' + path + '.json',
			success: function (data) {
				var parameters = data['parameters'];
				console.log(parameters);

				var html = '';

				// Keep the path
				html += '<input type="hidden" id="path" value="' + path + '">';

				// Need to request a title
				html += '<label>Device Name</label>';
				html += '<input type="text" id="name">';
				html += '<br /><br />';

				html += '<div id="accessor-new-parameters">';
				for (var i=0; i<parameters.length; i++) {
					var parameter = parameters[i];

					html += '<label>' + parameter.name + '</label>';
					html += '<input type="text" name="' + parameter.name + '">';
					html += '<br />';
				}
				html += '</div>';

				// Add a button
				html += '<button type="button" id="button-accessor-new">Create Accessor</button>';

				$("#accessor-new form").html(html);
			}
		});
	}
});

$('#accessor-new').on('click', '#button-accessor-new', function () {
	var new_device = {
		parameters: {},
		path: $('#accessor-new form input#path').val(),
		custom_name: $('#accessor-new form input#name').val()
	};

	$('#accessor-new-parameters input:text').each(function () {
		var param_name = $(this).attr('name');
		var param_value = $(this).val();

		new_device.parameters[param_name] = param_value;
	});

	$.ajax({
		url: '/create',
		type: 'POST',
		dataType: 'json',
		contentType: 'application/json',
		data: JSON.stringify(new_device),
		success: function (data) {
			console.log('Created device.');

			var html = '';
			html += '<option value="' + new_device.custom_name + '">' + new_device.custom_name + '</option>';
			$("#device-select").append(html);

			// Clear create device form
			$("#accessor-new form").html('');
		},
		error: function () {
			console.log('Failed to create device.');
		}
	});
});

$("#device-select").change(function () {
	if ($(this).val() != "default") {
		var name = $(this).val();

		function init_accessor (data) {
			var accessor = data;

			$("#accessor-interface").html(accessor.html);

			// Activate all sliders
			$('#accessor-'+accessor.uuid+' .slider').each(function () {
				$(this).slider().on('slideStop', function (slide_event) {
					rpc_post(accessor.uuid, $(this).attr('id'), slide_event.value);
				});
			});

			// Activate all color pickers
			$('#accessor-'+accessor.uuid+' .colorpicker').colpick({
				flat: true,
				layout: 'hex',
				submit: 0,
				onChange: function (hsb, hex, rgb, el, bySetColor) {
					rpc_post(accessor.uuid, $(this).attr('id'), hex);
				}
			});

			// Setup callbacks for buttons and check boxes
			$('#accessor-'+accessor.uuid).on('click', '.accessor-arbitrary-input-button', function () {
				var port = $(this).parents('.port-html-group').find('.port');
				rpc_post(accessor.uuid, port.attr('id'), port.val());
			});


			$('#accessor-'+accessor.uuid).on('click', '.accessor-get', function () {
				var port = $(this).parents('.port-html-group').find('.output-port');
				rpc_get(accessor.uuid, port.attr('id'));
			});

			$('#accessor-'+accessor.uuid).on('click', '.accessor-checkbox', function () {
				rpc_post(accessor.uuid, $(this).attr('id'), $(this).is(':checked'));
			});

			$('#accessor-'+accessor.uuid).on('click', '.accessor-button', function () {
				rpc_post(accessor.uuid, $(this).attr('id'), null);
			});

			// init all with GET
			for (var i=0; i<accessor.ports.length; i++) {
				if (accessor.ports[i].directions.indexOf('output') > -1) {
					rpc_get(accessor.uuid, accessor.ports[i].uuid, accessor.ports[i].type);
				}
			}
		}

		if (name in devices) {
			init_accessor(devices[name]);

		} else {
			$.ajax({url: '/device/' + name,
				success: function (data) {
					devices[name] = data;
					init_accessor(data);
				}
			});
		}
	}
});

function rpc_post (uuid, port_uuid, arg) {
	var accessor = $('#accessor-'+uuid);
	var device_name = accessor.attr('data-device-name');

	if (port_uuid.indexOf('port-') == 0) {
		port_uuid = port_uuid.substring(5, port_uuid.length);
	}
	var port = $('#port-'+port_uuid);
	var port_name = port.attr('data-port');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	url = '/active/' + device_name + slash + port_name;

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

function rpc_get (uuid, port_uuid, port_type) {
	console.log("rpc_get (" + uuid + ", " + port_uuid + ", " + port_type + ")");
	var accessor = $('#accessor-'+uuid);
	var device_name = accessor.attr('data-device-name');

	if (port_uuid.indexOf('port-') == 0) {
		port_uuid = port_uuid.substring(5, port_uuid.length);
	}
	var port = $('#port-'+port_uuid);
	var port_name = port.attr('data-port');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	url = '/active/' + device_name + slash + port_name;

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
