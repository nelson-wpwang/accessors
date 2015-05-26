/* vim: set noet ts=2 sts=2 sw=2: */

var devices = {};

// Choose an accessor type to create a device from
$("#accessor-select").change(function () {
	new_device_alert_clear();

	if ($(this).val() == 'default') {
		$("#accessor-new form").html('');
		return;
	}

	// Clear the area where parameters are input
	$("#accessor-new form").html('');

	var path = $(this).val();

	$.ajax({url: '/accessor' + path + '.json',
		success: function (data) {
			if (data.success) {
				data = data.data;
				var parameters = data.parameters;

				var html = '';
				var req_param_html = '';
				var dfl_param_html = '';

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
				if (parameters.length) {
					html += '<div id="accessor-new-parameters-title">Parameters</div>';
					for (var i=0; i<parameters.length; i++) {
						var parameter = parameters[i];
						var param_html = ''

						param_html += '<div class="form-group">';
						param_html +=   '<label class="col-sm-3 control-label">' + parameter.name + '</label>';
						param_html +=   '<div class="col-sm-7">';
						if (parameter.required) {
							param_html +=     '<input type="text" class="form-control" name="' + parameter.name + '">';
						} else {
							param_html +=     '<input type="text" class="form-control" name="' + parameter.name + '" value="' + parameter.default + '">';
						}
						param_html +=   '</div>';
						param_html += '</div>';

						if (parameter.required) {
							req_param_html += param_html;
						} else {
							dfl_param_html += param_html;
						}
					}
					html += req_param_html;
					if (dfl_param_html.length) {
						html += '<hr />';
						html += dfl_param_html;
					}
					html += '</div>';
				}
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
}).trigger('change');

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
		$("#accessor-interface").html('');
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
				accessor_function_start(accessor.uuid);
				rpc_post(accessor.uuid, port_meta.name, slide_event.value, function () {
					accessor_function_stop(accessor.uuid);
				});
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
				accessor_function_start(accessor.uuid);
				rpc_post(accessor.uuid, port_meta.name, hex, function () {
					accessor_function_stop(accessor.uuid);
				});
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
			accessor_function_start(accessor.uuid);
			rpc_post(accessor.uuid, port_meta.name, port.val(), function () {
				accessor_function_stop(accessor.uuid);
			});
		});

		// For refreshing a port (read from output)
		$('#accessor-'+accessor.uuid).on('click', '.accessor-refresh', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			accessor_function_start(accessor.uuid);
			rpc_get(accessor.uuid, port, port_meta.name, port_meta, function () {
				accessor_function_stop(accessor.uuid);
			});
		});

		// Checkbox was clicked
		$('#accessor-'+accessor.uuid).on('click', '.accessor-checkbox', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			accessor_function_start(accessor.uuid);
			rpc_post(accessor.uuid, port_meta.name, $(this).is(':checked'), function () {
				accessor_function_stop(accessor.uuid);
			});
		});

		// Port type of button
		$('#accessor-'+accessor.uuid).on('click', '.accessor-button', function () {
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);
			accessor_function_start(accessor.uuid);
			rpc_post(accessor.uuid, port_meta.name, null, function () {
				accessor_function_stop(accessor.uuid);
			});
		});

		// For watching an observe port
		$('#accessor-'+accessor.uuid).on('click', '.accessor-observe', function () {
			var button = $(this);
			var port_meta = get_port_meta($(this));
			var port = $('#port-' + port_meta.uuid);

			if (button.html() == '»') {
				// Need to start the observe
				rpc_ws(accessor.uuid, port, port_meta.name, port_meta, function (sock) {
					button.html('&#9632;');
					button.data('sock', sock);
				});
			} else {
				button.data('sock').close();
				button.html('&#187;');
			}
		});

		// Generic showhide helpers. Give the showhidable id="foo" and a clickable
		// object that controls it id="foo-control", class="control-showhide"
		$('#accessor-'+accessor.uuid).on('click', '.control-showhide', function () {
			var controlee = $(this).attr("id").slice(0,-8);
			$("#"+controlee).toggle();
		});

		// init all with GET
		var number_to_init = 0;
		for (var i=0; i<accessor.ports.length; i++) {
			if (accessor.ports[i].directions.indexOf('output') > -1) {
				var port = $('#port-' + accessor.ports[i].uuid);
				number_to_init += 1;
			}
		}
		function after_port_init () {
			number_to_init -= 1;
			if (number_to_init == 0) {
				accessor_function_stop(accessor.uuid);
			}
		}
		if (number_to_init > 0) {
			accessor_function_start(accessor.uuid);
			for (var i=0; i<accessor.ports.length; i++) {
				if (accessor.ports[i].directions.indexOf('output') > -1) {
					var port = $('#port-' + accessor.ports[i].uuid);
					rpc_get(accessor.uuid, port, accessor.ports[i].name, accessor.ports[i], after_port_init);
				}
			}
		}

	}

	if (name in devices) {
		init_accessor(devices[name]);

	} else {
		$.ajax({url: '/device/' + escape(name),
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

function rpc_post (accessor_uuid, port_name, arg, callback) {
	var accessor = $('#accessor-'+accessor_uuid);
	var device_name = accessor.attr('data-device-name');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	var url = '/active/' + device_name + slash + port_name;

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
			if (typeof callback === 'function') {
				callback();
			}
		},
		error: function (err) {
			accessor_alert_error(accessor_uuid, err);
			if (typeof callback === 'function') {
				callback();
			}
		}
	});
}

function format_units (val, units) {
	if (units == 'undefined') {
		return val;
	}
	if (units == 'currency_usd') {
		return format_currency_usd(parseFloat(val));
	} else if (units == 'watts') {
		return parseFloat(val).toFixed(1) + ' Watts';
	}
	return val;
}

function port_got_data (port, directions, type, units, data) {
	if (type == 'object') {
		var to_show = JSON.stringify(data, null, '\t');
		port.val(to_show);
	} else if (type == 'bool') {
		port.prop('checked', data==true);
	} else if (type == 'select') {
		port.val(data);
	} else if (type == 'color') {
		port.colpickSetColor('#'+data, true);
	} else if (port.hasClass('slider')) {
		port.slider('setValue', parseFloat(data));
	} else if (directions.length == 1 && directions[0] == 'output') {
		port.html(format_units(data, units));
	} else {
		port.val(format_units(data, units));
	}
}

function rpc_get (accessor_uuid, port, port_name, port_meta, callback) {
	console.log("rpc_get (" + accessor_uuid + ", " + port_name + ", " + port_meta.type + ")");
	var accessor = $('#accessor-'+accessor_uuid);
	var device_name = accessor.attr('data-device-name');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	var url = '/active/' + device_name + slash + port_name;

	console.log('Get: ' + url);
	$.ajax({url: url,
		type: 'GET',
		success: function (data) {

			if (!data.success) {
				accessor_alert_error(accessor_uuid, data.message);
			} else {
				port_got_data(port, port_meta.directions, port_meta.type, port_meta.units, data.data);
			}

			if (typeof callback === 'function') {
				callback();
			}
		},
		error: function (err) {
			accessor_alert_error(accessor_uuid, err);
			if (typeof callback === 'function') {
				callback();
			}
		}
	});
}

function rpc_ws (accessor_uuid, port, port_name, port_meta, callback) {
	console.log("rpc_ws (" + accessor_uuid + ", " + port_name + ", " + port_meta.type + ")");
	var accessor = $('#accessor-'+accessor_uuid);
	var device_name = accessor.attr('data-device-name');

	var slash = '';
	if (port_name.substring(0,1) != '/') {
		slash = '/';
	}

	url = '/active/' + device_name + slash + port_name;

	var sock = new WebSocket(ws_url(url));

	sock.onopen = function (evt) {
		if (typeof callback === 'function') {
			callback(sock);
		}
	}

	sock.onmessage = function (evt) {
		var data = JSON.parse(evt.data);
		if (!data.success) {
			accessor_alert_error(accessor_uuid, 'Error setting up Observe.');
		} else {
			port_got_data(port, port_meta.directions, port_meta.type, port_meta.units, data.data);
		}
	}

	sock.onerror = function (evt) {
		accessor_alert_error(accessor_uuid, 'Error with Observe.');
	}
}
