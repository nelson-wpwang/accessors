#!/usr/bin/env node

/*
 * Run a "central" accessors application
 */

var central = require('./central');

if (process.argv.length < 3) {
	console.log('Need to specify the name of the top level application');
	console.log('JSON file in order to run an application.');
	console.log('');
	console.log('usage: ' + process.argv[1] + ' <application name> [<config file>]');
	throw 'no application';
}

var app_name = process.argv[2];
if (process.argv.length >= 4) {
	config = require('./'+process.argv[3]+'.json');
} else {
	config = {};
}

var app = require('./'+app_name+'.json');
c = new central(app, config);
