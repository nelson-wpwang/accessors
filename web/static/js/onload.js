
var accessors = [];


$("#location-select").change(function () {
	if ($(this).val() != 0) {
		$.ajax({url: '/location' + $(this).val(),
	            success: function (data) {
	            	accessors = data['accessors'];

	            	for (i=0; i<accessors.length; i++) {
	            		$("#accessor-select").append('<option value="'+i+'">'+accessors[i].name+'</option>')
	            	}
	            	$("#accessor-select").show();
	            }});
	}
	console.log($(this).val());
});


$("#accessor-select").change(function () {
	if ($(this).val() != "default") {
		$("#accessor-interface").html(accessors[$(this).val()].html);
	}
});
