
var speaker = require('speaker');
var _ = require('lodash');

var util = require('util');
var Readable = require('stream').Readable;
var EventEmitter = require('events').EventEmitter;

module.exports.Player = function (options) {
	var player = this;

	// this.speaker = new speaker(options);
	this.reader = new Readable();

	// Store all of the samples in buffers that are ready to send
	// to the stream
	this.buffers = [];

	this.options = {
		channels: 2,
		bitDepth: 16,
		sampleRate: 44100
	};
	_.assign(this.options, options);


	// Connect the stream/pipe
	this.reader.pipe(new speaker(this.options));

	this.reader._read = function (n) {
		var pushed_len = 0;

		// Notify the player that we read from the stream
		player.emit('read');

		// Push buffers until we get to n
		while (pushed_len < n) {
			var b = player.buffers.pop();

			if (b) {
				pushed_len += b.length;
				this.push(b);
			} else {
				break;
			}
		}
	}

}
util.inherits(module.exports.Player, EventEmitter);

module.exports.Player.prototype.play = function (samples) {
	var sampleSize = this.options.bitDepth / 8;
	var blockAlign = sampleSize * this.options.channels;
	var numSamples = samples.length / this.options.channels;
	var buf = new Buffer(numSamples * blockAlign);

	for (var i=0; i<numSamples; i++) {
		for (var channel=0; channel<this.options.channels; channel++) {
			var val = samples[(i*this.options.channels) + channel];
			var offset = (i * sampleSize * this.options.channels) + (channel * sampleSize);
			// Write the sample to the buffer using the buffer functions
			buf['writeInt' + this.options.bitDepth + 'LE'](val, offset);
		}
	}
	this.buffers.push(buf);
}
