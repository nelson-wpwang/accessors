
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

var k;

$("#accessor-select").change(function () {
	if ($(this).val() != "default") {
		accessor = accessors[$(this).val()];
		$("#accessor-interface").html(accessor.html);

		// Set the name
		accessor_name = accessor.name.replace(' ', '');

		// Load the parameters
		parameters = [];
		for (i=0; i<accessor.parameters.length; i++) {
			parameters[accessor.parameters[i].name] = accessor.parameters[i].value;
		}

		// Oh yeah, call eval on code we downloaded.
		// As a wise undergrad once said: "Safety Off"
		var code = accessor.code.code;
		$.globalEval(code);

		// Call init now.
		init();
	}
});


$('#accessor-interface').on('click', '.accessor-arbritrary-input-button', function () {
	var accessor_port = $(this).attr('data-port');
	var accessor_func = $(this).attr('data-function');
	if (accessor_func in window) {
		// If this function was defined in the accessor then use it.
		window[accessor_func]($('#'+accessor_port).val());
	} else {
		// The element specific function doesn't exist, just use fire()
		fire();
	}
});
