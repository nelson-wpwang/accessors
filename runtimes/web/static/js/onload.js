/* vim: set noet ts=2 sts=2 sw=2: */

var accessors = [];


$("#location-select").change(function () {
	if ($(this).val() != 0) {
		$("#accessor-interface").text('');
		$.ajax({url: '/location' + $(this).val(),
			success: function (data) {
				if ('status' in data && data['status'] == 'error') {
					alert_error('Unable to load accessors for that location.');

				} else {

					accessors = data['accessors'];
					$("#accessor-select option[data-temp='true']").remove();

					for (i=0; i<accessors.length; i++) {
						$("#accessor-select").append('<option value="'+i+'" data-temp="true">'+accessors[i].name+'</option>')
					}
					$("#accessor-select").show();

				}
			}});
	}
}).trigger('change');

$("#accessor-select").change(function () {
	if ($(this).val() != "default") {
		accessor = accessors[$(this).val()];
		$("#accessor-interface").html(accessor.html);

		// Check to see if any accessor port names are reserved javascript
		// functions and won't work because of the conflict.
		for (var i=0; i<accessor.ports.length; i++) {
			var port = accessor.ports[i];
			if (typeof window[port.clean_name] == 'function') {
				alert_error('Port name "'+port.clean_name+'" conflicts with an \
existing JavaScript function. The name of the port will need to be changed \
in order for the accessor to work.');
			}
		}

		// Oh yeah, call eval on code we downloaded.
		// As a wise undergrad once said: "Safety Off"
		var code = accessor.code;
		$.globalEval(code);

		// Call init now.
		print(window[accessor.clean_name]);
		Q.spawn(function* () {
			yield* window[accessor.clean_name].init();
		});
	}
});

function call_accessor (element, arg) {
	var accessor_name = element.attr('data-accessorname');
	var accessor_func = element.attr('data-function');

	Q.spawn(function* () {
		yield* window[accessor_name][accessor_func](arg);
	});
}

// Call the correct method in the object loaded for the accessor
$('#accessor-interface').on('click', '.accessor-arbitrary-input-button', function () {
	var accessor_port = $(this).attr('data-port');
	call_accessor($(this), $('#'+accessor_port).val());
});

$('#accessor-interface').on('click', '.accessor-checkbox', function () {
	var accessor_port = $(this).attr('data-port');
	call_accessor($(this), $('#'+accessor_port).is(':checked'));
});

$('#accessor-interface').on('click', '.accessor-button', function () {
	var accessor_port = $(this).attr('data-port');
	call_accessor($(this), null);
});
