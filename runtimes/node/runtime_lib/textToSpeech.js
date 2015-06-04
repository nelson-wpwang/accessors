var debug_lib = require('debug');

var Q         = require('q');
var say       = require('say');

var debug = debug_lib('accessors:textToSpeech:debug');
var info  = debug_lib('accessors:textToSpeech:info');
var warn  = debug_lib('accessors:textToSpeech:warn');
var error = debug_lib('accessors:textToSpeech:error');


module.exports.say = function* (text) {
	debug('text_to_speech::say(%s)', text);
	var defer = Q.defer();
	say.speak(null, text, function () {
		defer.resolve();
	});
	return yield defer.promise;
}