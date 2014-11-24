
function alert_error (error_str) {
	html = '<div class="alert alert-danger" role="alert">'+error_str+'</div>';
	$('#alerts').empty();
	$('#alerts').html(html);
}

function accessor_function_start (name) {
	$('#accessor-'+name+' .spinner').show();
}

function accessor_function_stop (name) {
	$('#accessor-'+name+' .spinner').hide();
}
