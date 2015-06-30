var dbg      = require('debug');
var ipp      = require('ipp');
var pdf      = require('pdfkit');
var through2 = require('through2');
var Q        = require('q');

var debug = dbg('accessors:printer:debug');
var info  = dbg('accessors:printer:info');
var warn  = dbg('accessors:printer:warn');
var error = dbg('accessors:printer:error');

module.exports.Printer = function (url) {
	this.url = url;
};

module.exports.Printer.prototype.print = function* (str) {
	var printer_url = this.url;
	var defer = Q.defer();

	var doc = new pdf({margin: 0});
	var out = new Buffer(0);

	doc.pipe(through2(function (chunk, enc, t2callback) {
		out = Buffer.concat([out, chunk]);
		t2callback();

	}, function (t2callback) {
		debug('Starting print job');

		var printer = ipp.Printer(printer_url);

		var msg = {
			'operation-attributes-tag': {
				'requesting-user-name': 'Accessors',
				'job-name': 'printout',
				'document-format': 'application/pdf'
			},
			data: out
		}

		printer.execute('Print-Job', msg, function (err, res) {
			t2callback();
			defer.resolve(res);
		});
	}));

	doc.text(str, 50, 50);
	doc.end();

	return yield defer.promise;
}

