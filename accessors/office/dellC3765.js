// name: Dell C3765DNF Printer
// author: Brad Campbell
// email:  bradjc@umich.edu

/*
 * Dell C3765DNF Printer
 * =====================
 *
 * Get information from the printer.
 */

function* init () {
	create_port('Cyan');
	create_port('Magenta');
	create_port('Yellow');
	create_port('Black');
	create_port('Waste');
	create_port('Tray1');
}

function* get_status_page () {
	var url = get_parameter('url');
	var html = yield* rt.http.readURL(url + '/status/status.htm');
	return html;
}

// This is not a great function. But it's the fastest way to get it done.
// It should be replaced later.
function find_in_page (page, field) {
	var start = page.indexOf(field);
	rt.log.debug('start: ' + start);
	var end_tag = page.indexOf('/', start+field.length+2) - 1;
	rt.log.debug('end_tag: ' + end_tag);

	// Search for the ">" symbol
	var start_tag = 0;
	for (var i=1; i<100; i++) {
		var c = page.substr(end_tag-i, 1);
		if (c == '>') {
			start_tag = end_tag-i+1;
			break;
		}
	}
	rt.log.debug('start tag: ' + start_tag);

	return page.substr(start_tag, end_tag-start_tag);
}

Cyan.output = function*  () {
	var status_html = yield* get_status_page();
	var status = find_in_page(status_html, 'Cyan Drum Cartridge');
	rt.log.log(status);
	return status;
}

Magenta.output = function* () {
	var status_html = yield* get_status_page();
	var status = find_in_page(status_html, 'Magenta Drum Cartridge');
	rt.log.log(status);
	return status;
}

Yellow.output = function* () {
	var status_html = yield* get_status_page();
	var status = find_in_page(status_html, 'Yellow Drum Cartridge');
	rt.log.log(status);
	return status;
}

Black.output = function* () {
	var status_html = yield* get_status_page();
	var status = find_in_page(status_html, 'Black Drum Cartridge');
	rt.log.log(status);
	return status;
}

Waste.output = function* () {
	var status_html = yield* get_status_page();
	var status = find_in_page(status_html, 'Waste Toner Box');
	rt.log.log(status);
	return status;
}

Tray1.output = function* () {
	var status_html = yield* get_status_page();
	var status = find_in_page(status_html, '35%>Output Tray');
	rt.log.log(status);
	return status;
}
