
/*
 * Run a "central" accessors application
 */

if (process.argv.length != 2) {
	console.log('Need to specify the name of the top level application');
	console.log('JSON file in order to run an application.');
	console.log('');
	console.log('usage: ' + process.argv[0] + ' <application name>');
	throw 'no application';
}

var app_name = process.argv[1];
var app = require(app_name);
c = new central(app);
