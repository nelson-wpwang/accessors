/* Synchronous / Asynchronous callback helper function.
 *
 * This function is used to call an unknown function pointer and handle
 * it correctly if it is a normal function or a generator. All arguments that
 * should be passed to the fn should be added after the error fn.
 */

var domain = require('domain');
var Q      = require('q');

module.exports.callFn = function (fn) {
	var sub_arguments = Array.prototype.slice.call(arguments).slice(1);
	var d = domain.create();

	var error_fn = function (err) {
		d.exit();
		rt.log.warn("Uncaught exception from a call");
		console.log(err);
	}
	d.on('error', error_fn);

	d.run(function() {
		var r = fn.apply(this, sub_arguments);
		if (r && typeof r.next === 'function') {
			var def = Q.async(function* () {
				r = yield* fn.apply(this, sub_arguments);
			});
			var finished = function () {
				debug("call finished asynchronous run");
			}
			def().done(finished, function (err) {
				throw err;
			});
			debug("call running asynchronously");
		}
	});
}

module.exports.forEach = function (arr, callback) {
	for (var i=0; i<arr.length; i++) {
		callFn(callback, arr[i]);
	}
}
