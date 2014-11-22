
var accessors = [];


$("#location-select").change(function () {
	if ($(this).val() != 0) {
		$.ajax({url: '/location' + $(this).val(),
			success: function (data) {
				if ('status' in data && data['status'] == 'error') {
					alert_error('Unable to load accessors for that location.');

				} else {

					accessors = data['accessors'];

					for (i=0; i<accessors.length; i++) {
						$("#accessor-select").append('<option value="'+i+'">'+accessors[i].name+'</option>')
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

		// Oh yeah, call eval on code we downloaded.
		// As a wise undergrad once said: "Safety Off"
		var code = accessor.code;
		$.globalEval(code);

		// Call init now.
		window[accessor_name].init()
	}
});

function call_accessor (element, arg) {
	var accessor_name = element.attr('data-accessorname');
	var accessor_func = element.attr('data-function');

	var function_result = window[accessor_name][accessor_func](arg);
	if (function_result != undefined) {
		Q.spawn(function* () {
			yield* function_result;
		});
	}
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
