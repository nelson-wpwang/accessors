/* vim: set noet ts=2 sts=2 sw=2: */

var accessors = [];


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
		accessor = accessors[$(this).val()];
		$("#accessor-interface").html(accessor.html);

		// Activate all sliders
		$('#accessor-'+accessor.uuid+' .slider').each(function () {
			$(this).slider().on('slideStop', function (slide_event) {
				post_accessor($(this), slide_event.value);
			});
		});

		// Activate all color pickers
		$('#accessor-'+accessor.uuid+' .colorpicker').colpick({
			flat: true,
			layout: 'hex',
			submit: 0,
			onChange: function (hsb, hex, rgb, el, bySetColor) {
				post_accessor($(this), hex);
			}
		});

		// Setup callbacks for buttons and check boxes
		$('#accessor-'+accessor.uuid).on('click', '.accessor-arbitrary-input-button', function () {
			var accessor_port = $(this).attr('data-port');
			post_accessor($(this), $('#'+accessor_port).val());
		});

		$('#accessor-'+accessor.uuid).on('click', '.accessor-checkbox', function () {
			var accessor_port = $(this).attr('data-port');
			post_accessor($(this), $('#'+accessor_port).is(':checked'));
		});

		$('#accessor-'+accessor.uuid).on('click', '.accessor-button', function () {
			post_accessor($(this), null);
		});

		// Call init now.
		call_accessor($(this), init)
	}
});

function post_accessor (element, arg) {
	var accessor_name = element.attr('data-accessorname');
	var accessor_func = element.attr('data-function');

	var accessor = element.parents('.accessor');
	var device_name = accessor.attr('data-device-name');
	var device_group = accessor.attr('data-device-group');

	Q.spawn(function* () {
		yield* window[accessor_name][accessor_func](arg);
	});
}
