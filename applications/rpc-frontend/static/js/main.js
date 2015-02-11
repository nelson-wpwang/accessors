
function alert_error (error_str) {
	html = '<div class="alert alert-danger" role="alert">'+error_str+'</div>';
	$('#alerts').empty();
	$('#alerts').html(html);
}

function accessor_alert_error (accessorname, error_str) {
	html = '<div class="alert alert-danger" role="alert">'+error_str+'</div>';
	$('#accessor-'+accessorname+'-alerts').empty();
	$('#accessor-'+accessorname+'-alerts').html(html);
}

function accessor_alert_clear (accessorname) {
	$('#accessor-'+accessorname+'-alerts').empty();
}

function format_currency_usd (price) {
	p = price.toFixed(2);

	if (p < 0) {
		return '<span class="negative">-$' + (p*-1.0).toFixed(2) + '</span>';
	} else {
		return '<span class="positive">$' + p + '</span>';
	}
}

var AccessorRuntimeException = Error;

function accessor_get (accessorname, field) {
	var port = $('#port-'+accessorname+field);

	// Check if this is a valid port
	if (!port.length) {
		throw new AccessorRuntimeException('Error calling get(): "'+field+'" is not a valid port name.');
	}
	// Can't call get() on an output
	if (port.attr('data-portdirection') == 'output') {
		throw new AccessorRuntimeException('Error calling get() on port: "'+field+'". Cannot call get() on an output.');
	}
	// Check if this field is being accessed before it was ever set
	// if (port.attr('value') === undefined) {
	// 	// If there was never a value
	// 	throw new AccessorRuntimeException('Error calling get() on uninitialized port: "'+field);
	// }

	if (port.attr('type') == 'checkbox') {
		return port.prop('checked');
	}

	if (port.attr('data-porttype') == 'bool') {
		return port.val() == 'true';
	}

	return port.val();
}

function accessor_set (accessorname, field, value) {
	var port = $('#port-'+accessorname+field);

	if (!port.length) {
		throw new AccessorRuntimeException('Error calling set(): "'+field+'" is not a valid port name.');
	}
	if (port.attr('data-portdirection') == 'input') {
		throw new AccessorRuntimeException('Error calling set() on port: "'+field+'". Cannot call set on an input.');
	}

	if (port.attr('type') == 'checkbox') {
		if (value) {
			port.prop('checked', true);
		} else {
			port.prop('checked', false);
		}

	} else if (port.attr('type') == 'text' ||
	           port.attr('type') == 'hidden') {
		if (port.hasClass('slider')) {
			port.slider('setValue', Number(value));
		}

		port.val(value);

	} else if (port.prop('tagName') == 'SELECT') {
		$('#port-'+accessorname+field+' option:eq('+value+')').prop('selected', true);

	} else if (port.attr('data-portdirection') == 'output') {
		if (port.attr('data-porttype') == 'currency_usd') {
			console.log(format_currency_usd(value));
			port.html(format_currency_usd(value));
		} else {
			port.text(value);
		}

	} else if (port.prop('tagName') == 'DIV' && port.hasClass('colorpicker')) {
		port.colpickSetColor(value);

	}
};

function accessor_function_start (name) {
	accessor_alert_clear(name);
	$('#accessor-'+name+' .spinner').show();
}

function accessor_function_stop (name) {
	$('#accessor-'+name+' .spinner').hide();
}

function accessor_exception (accessorname, err) {
	accessor_alert_error(accessorname, err.message);
}
