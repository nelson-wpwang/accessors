var dnssd = require('mdns');
var http = require('http');

var accessors = require('accessors')('http://localhost:6565');

var sequence = [
	dnssd.rst.DNSServiceResolve()
];

var browser_opts = {
	resolverSequence: sequence
};

var found = [];

var browser = dnssd.createBrowser(dnssd.tcp('accessor_sensor_temperature'), browser_opts);
browser.on('serviceUp', function (service) {
	// console.log(service);

	// Strip last "."
	var host = service.host;
	if (host.substr(host.length-1) == '.'){
		host = host.substr(0, host.length-1);
	}

	var url = host + ':' + service.port;
	var path = service.txtRecord.accessor_path;

	if (found.indexOf(url) == -1) {
		found.push(url);

		accessors.create_accessor(path, {url: url}, function (accessor) {
			accessor.Temperature(function (val) {
				console.log('temp: ' + val);
			});
		});
	}
});

browser.on('error', function (err) {
	console.log(err);
});

browser.start()