/* This runtime conforms to accessor runtime v0.1.0 */
/* vim: set noet ts=2 sts=2 sw=2: */
'use strict';

try {
	var debug_lib    = require('debug');
	var EventEmitter = require('events').EventEmitter;
	var urllib       = require('url');
	var util         = require('util');

	var domain       = require('domain');
	var Q            = require('q');
	var request      = require('request');
	var tinycolor    = require('tinycolor2');
	var atob         = require('atob');
	var btoa         = require('btoa');
	var coap         = require('coap');
	var amqp         = require('amqp');
	var dgram        = require('dgram');
	var net          = require('net');
	var say          = require('say');
	var socketio_old = require('socket.io-client');
	var through2     = require('through2');
	var WebSocket    = require('ws');
} catch (e) {
	console.log("** Missing import in the node runtime library");
	console.log("** This is an error with the accessor runtime module.");
	throw e;
}


var AcessorRuntimeException = Error;



/*
 * Create the over-arching runtime object that lets us scope all of this
 * accessor runtime code nicely.
 */

var rt = Object();

/*** GENERAL UTILITY ***/

rt.version = function version (set_to) {
	return "0.1.0";
}

rt.time = Object();

rt.time.sleep = function* (time_in_ms) {
	var deferred = Q.defer();
	setTimeout(deferred.resolve, time_in_ms);
	yield deferred.promise;
}




var debug = debug_lib('accessors:debug');
var info  = debug_lib('accessors:info');
var warn  = debug_lib('accessors:warn');
var error = debug_lib('accessors:error');

/*** SOCKETS ***/
/*** HTTP REQUESTS ***/
/*** COAP REQUESTS ***/
/*** WEBSOCKET CONNECTIONS ***/
/*** RABBITMQ / AMQP CONNECTIONS ***/
/*** GATDv0.1 ***/
/*** Text to Speech ***/
/*** BLE ***/
/*** COLOR FUNCTIONS ***/


/*** ENCODING FUNCTIONS ***/



/*** OTHER / UNDOCUMENTED / WORK-IN-PROGRESS ***/

/*
Functions that accessors can use. Based on a very basic version of
javascript.
*/



/* Parse an HTML document for an element with the given ID, and then return
 * the value of that element. Only works in very simple cases where there
 * not nested elements or crazy spaces.
 */
function getElementValueById (html, id) {
	throw new AccessorRuntimeException("very funny");
}


exports.version   = rt.version;
exports.log       = rt.log;
exports.time      = rt.time;
exports.helper    = rt.helper;
exports.socket    = rt.socket;
exports.httpClient      = rt.httpClient;
exports.coap      = rt.coap;
exports.webSocket = rt.webSocket;
exports.amqp      = rt.amqp;
exports.gatd_old  = rt.gatd_old;
exports.text_to_speech = rt.text_to_speech;
exports.ble       = rt.ble;
exports.color     = rt.color;
exports.encode    = rt.encode;
