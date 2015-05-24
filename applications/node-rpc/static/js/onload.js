/* vim: set noet ts=2 sts=2 sw=2: */

var devices = {};

// Choose an accessor type to create a device from
$("#accessor-select").change(function () {
	new_device_alert_clear();

	if ($(this).val() == 'default') {
		return;
	}

	// Clear the area where parameters are input
	$("#accessor-new form").html('');

	var path = $(this).val();

	$.ajax({url: '/accessor' + path + '.json',
		success: function (data) {
			if (data.success) {
				data = data.data
				var parameters = data['parameters'];

				var html = '';

				// Keep the path
				html += '<input type="hidden" id="path" value="' + path + '">';

				// Need to request a title
				html += '<div class="form-group">';
				html +=   '<label class="col-sm-3 control-label">Device Name</label>';
				html +=   '<div class="col-sm-8">';
				html +=     '<input type="text" id="name" class="form-control" placeholder="Name the device something memorable">';
				html +=   '</div>';
				html += '</div>';

				html += '<div id="accessor-new-parameters" class="well">';
				html += '<div id="accessor-new-parameters-title">Parameters</div>';
				for (var i=0; i<parameters.length; i++) {
					var parameter = parameters[i];

					html += '<div class="form-group">';
					html +=   '<label class="col-sm-3 control-label">' + parameter.name + '</label>';
					html +=   '<div class="col-sm-7">';
					html +=     '<input type="text" class="form-control" name="' + parameter.name + '">';
					html +=   '</div>';
					html += '</div>';
				}
				html += '</div>';
				html += '<div id="accessor-new-detail">';
				html +=   '<a href="http://accessors.io/view/accessor' + path + '">View Accessor Details</a>';
				html += '</div>';

				// Add a button
				html += '<button type="button" id="button-accessor-new" class="form-control">Create Device</button>';

				$("#accessor-new form").html(html);

			} else {
				new_device_alert_error(data.message);
			}
		},
		error: function () {
			new_device_alert_error('Error contacting the RPC server.');
		}
	});
});

// After entering the parameters, add the device on the RPC server.
$('#accessor-new').on('click', '#button-accessor-new', function () {
	new_device_alert_clear();

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
			if (data.success) {
				data = data.data;

				var html = '';
				html += '<option value="' + new_device.custom_name + '">' + new_device.custom_name + '</option>';
				$("#device-select").append(html);

				// Clear create device form
				$("#accessor-new form").html('');

				new_device_alert_success('Device "' + new_device.custom_name + '" created successfully.');

			} else {
				new_device_alert_error(data.message);
			}
		},
		error: function () {
			new_device_alert_error('Failed to contact the RPC server to create device.');
		}
	});
});

// From the list of created devices, load one to interact with
$("#device-select").change(function () {
	if ($(this).val() == "default") {
		return;
	}

	var name = $(this).val();

	function init_accessor (data) {
		var accessor = data;

		$("#accessor-interface").html(accessor.html);

		// Activate all sliders
		$('#accessor-'+accessor.uuid+' .slider').each(function () {
			$(this).slider().on('slideStop', function (slide_event) {
				var port_meta = get_port_meta($(this));
				var port = $('#port-' + port_meta.uuid);
				rpc_post(accessor.uuid, port_meta.name, slide_event.value);
			});
		});

		// Activate all color pickers
		$('#accessor-'+accessor.uuid+' .colorpicker').colpick({
			flat: true,
			layout: 'hex',
			submit: 0,
			onChange: function (hsb, hex, rgb, el, bySetColor) {
				var port_meta = get_port_meta($(this));
				var port = $('#port-' + port_meta.uuid);
				rpc_post(accessor.uuid, port_meta.name, hex);
			}
		});

		// Setup callbacks for buttons and check boxes
		function get_port_meta (sel) {
			var port_meta_sel = sel.parents('.port-group').find('.port-group-meta');
			return JSON.parse(port_meta_sel.text());
		}

		// For POSTing new data (writing to an input port)
		$('#accessor-'+accessor.uuid).on('click', '.accessor-input', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			rpc_post(accessor.uuid, port_meta.name, port.val());
		});

		// For refreshing a port (read from output)
		$('#accessor-'+accessor.uuid).on('click', '.accessor-refresh', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			rpc_get(accessor.uuid, port, port_meta.name, port_meta);
		});

		// Checkbox was clicked
		$('#accessor-'+accessor.uuid).on('click', '.accessor-checkbox', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			rpc_post(accessor.uuid, port_meta.name, $(this).is(':checked'));
		});

		// Port type of button
		$('#accessor-'+accessor.uuid).on('click', '.accessor-button', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			rpc_post(accessor.uuid, port_meta.name, null);
		});

		// init all with GET
		for (var i=0; i<accessor.ports.length; i++) {
			if (accessor.ports[i].directions.indexOf('output') > -1) {
				var port = $('#port-' + accessor.ports[i].uuid);
				rpc_get(accessor.uuid, port, accessor.ports[i].name, accessor.ports[i]);
			}
		}
	}

	if (name in devices) {
		init_accessor(devices[name]);

	} else {
		$.ajax({url: '/device/' + name,
			success: function (data) {
				if (data.success) {
					devices[name] = data.data;
					init_accessor(data.data);
				} else {
					new_device_alert_error(data.message);
				}
			},
			error: function () {
				new_device_alert_error('Failed to contact the RPC server to load device.');
			}
		});
	}
}).trigger('change');

function rpc_post (accessor_uuid, port_name, arg) {
	var accessor = $('#accessor-'+accessor_uuid);
	var device_name = accessor.attr('data-device-name');

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
		contentType:"text/plain",
		success: function (data) {
			data = JSON.parse(data);
			if (!data.success) {
				accessor_alert_error(accessor_uuid, data.message);
			}
		},
		error: function () {
			accessor_alert_error(accessor_uuid, data.message);
		}
	});
}

function rpc_get (accessor_uuid, port, port_name, port_meta) {
	console.log("rpc_get (" + accessor_uuid + ", " + port_name + ", " + port_meta.type + ")");
	var accessor = $('#accessor-'+accessor_uuid);
	var device_name = accessor.attr('data-device-name');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	url = '/active/' + device_name + slash + port_name;

	console.log('Get: ' + url);
	$.ajax({url: url,
		type: 'GET',
		success: function (data) {
			if (!data.success) {
				accessor_alert_error(accessor_uuid, data.message);
			} else {
				if (port_meta.directions.length == 1 && port_meta.directions[0] == 'output') {
					port.text(data.data);
				} else if (port_meta.type == 'bool') {
					port.prop('checked', data.data==true);
				} else if (port_meta.type == 'select') {
					port.val(data.data);
				} else if (port_meta.type == 'color') {
					port.colpickSetColor('#'+data.data, true);
				} else if (port.hasClass('slider')) {
					port.slider('setValue', parseFloat(data.data));
				} else {
					port.val(data.data);
				}
			}
		}
	});
}
