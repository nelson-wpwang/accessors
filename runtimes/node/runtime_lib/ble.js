var debug_lib = require('debug');

var lib       = require('lib');

var noble     = require('noble');
var Q         = require('q');

var debug = debug_lib('accessors:ble:debug');
var info  = debug_lib('accessors:ble:info');
var warn  = debug_lib('accessors:ble:warn');
var error = debug_lib('accessors:ble:error');

var poweredOn = false;

// These are active callbacks that are waiting on scans
// holds arrays:
//   [scanner type, uuids, mac_address, callback, callbackdisconnect]
var scanners = [];

module.exports.Central = function* () {

	var b = Object();

	if (!poweredOn) {
		info('BLE waiting for powered on');
		var defer = Q.defer();
		noble.on('stateChange', function (state) {
			info('BLE state change: ' + state);
			if (state === 'poweredOn') {
				poweredOn = true;
				noble.startScanning([], true);
				info('Started BLE scan.');
				defer.resolve(b);
			} else if (state === 'poweredOff') {
				error('BLE appears to be disabled.');
				defer.resolve(null);
			}
		});
	} else {
		return b;
	}

	noble.on('discover', function (peripheral) {

		// Iterate all scanners, decide what to do
		lib.forEach(scanners, function (scanner) {
			var scanner_type = scanner[0];
			var uuids        = scanner[1];
			var name         = scanner[2];
			var mac_address  = scanner[3];

			// Check if this peripheral matches
			var matches = false;

			// Start with the uuids
			if (uuids.length > 0) {
				for (var i=0; i<uuids.length; i++) {
					if (peripheral.advertisement.serviceUuids.indexOf(uuids[i]) > -1) {
						matches = true;
						break;
					}
				}
			} else {
				matches = true;
			}

			// Now check the name
			if (name != null) {
				matches = false;
				if (typeof peripheral.advertisement.localName == 'string' &&
					peripheral.advertisement.localName.slice(0,name.length) == name) {
					matches = true;
				}
			}

			// Now check the mac address
			if (mac_address != null) {
				matches = false;
				if (mac_address == peripheral.address) {
					matches = true;
				}
			}

			if (matches) {
				// This advertisement matches this scanner. Now, what do we
				// do with it? This depends on what function the accessor
				// called to start scanning.
				if (scanner_type == 'SCANNER_ADVERTISEMENTS') {
					var callback = scanner[4];
					lib.callFn(callback, peripheral);

				} else if (scanner_type == 'SCANNER_CONNECT') {
					// We only want advertisements from devices that
					// are in a 'disconnected' state
					if (peripheral.state === 'disconnected') {
						var on_connect = scanner[4];
						var on_disconnect = scanner[5];
						var on_error = scanner[6];
						if (typeof on_disconnect === 'function') {
							peripheral.once('disconnect', on_disconnect);
						}
						peripheral.connect(function (err) {
							if (err) {
								error('Unable to connect to peripheral ' + err);
								// Make sure we don't just keep trying to connect
								// b.scanStop(scanner);
								if (typeof on_error === 'function') {
									lib.callFn(on_error, err);
								}
							} else {
								lib.callFn(on_connect, peripheral);
							}
						});
					}
				}
			}
		})
	})

	// The runtime will do its best to stay connected to a particular device.
	b.stayConnected = function (uuid, name, mac_address, on_connect, on_disconnect, on_error) {
		var uuids = [];
		if (uuid != null) {
			uuids = [uuid];
		}

		// Add this so whenever we find a matching device things will connect
		var scan_token = ['SCANNER_CONNECT', uuids, name, mac_address, on_connect, on_disconnect, on_error];
		scanners.push(scan_token);
		return scan_token;
	}





// module.exports.Central.prototype.scan = function (uuids, callback) {
b.scan = function (uuids, name, mac_address, callback) {

	// Add this so whenever we find a matching device things will connect
	var scan_token = ['SCANNER_ADVERTISEMENTS', uuids, name, mac_address, callback];
	scanners.push(scan_token);
	return scan_token;
};

// module.exports.Central.prototype.scanStop = function () {
b.scanStop = function (scan_token) {
	var to_remove = -1;

	// Find the scanner to remove
	for (var i=0; i<scanners.length; i++) {
		var same = true;
		for (var j=0; j<scanners[i].length; j++) {
			if (scanners[i][j] != scan_token[j]) {
				same = false;
				break;
			}
		}
		if (same) {
			to_remove = i;
			break;
		}
	}

	// Remove it
	scanners.splice(to_remove, 1);
}

// module.exports.Central.prototype.connect = function* (peripheral, on_disconnect) {
b.connect = function* (peripheral, on_disconnect) {
	var connect_defer = Q.defer();
	peripheral.connect(function (err) {
		// Call the disconnect callback properly if the user defined one
		if (typeof on_disconnect === 'function') {
			peripheral.on('disconnect', on_disconnect);
		}
		connect_defer.resolve(err);
	});
	return yield connect_defer.promise;
}

// module.exports.Central.prototype.disconnect = function* (peripheral) {
b.disconnect = function* (peripheral) {
	var disconnect_defer = Q.defer();
	peripheral.disconnect(function (err) {
		if (err) {
			error('BLE unable to disconnect peripheral.');
			error(err);
			disconnect_defer.resolve(err);
		} else {
			disconnect_defer.resolve(null);
		}
	});
	return yield disconnect_defer.promise;
}

// module.exports.Central.prototype.discoverServices = function* (peripheral, uuids) {
b.discoverServices = function* (peripheral, uuids) {
	var ds_defer = Q.defer();
	peripheral.discoverServices(uuids, function (err, services) {
		if (err) {
			error('BLE unable to discover services.');
			error(err);
			ds_defer.resolve(null);
		} else {
			ds_defer.resolve(services);
		}
	});
	return yield ds_defer.promise;
}

// module.exports.Central.prototype.discoverCharacteristics = function* (service, uuids) {
b.discoverCharacteristics = function* (service, uuids) {
	var dc_defer = Q.defer();
	service.discoverCharacteristics(uuids, function (err, characteristics) {
		if (err) {
			error('BLE unable to discover characteristics.');
			error(err);
			dc_defer.resolve(null);
		} else {
			dc_defer.resolve(characteristics);
		}
	});
	return yield dc_defer.promise;
}

// module.exports.Central.prototype.readCharacteristic = function* (characteristic) {
b.readCharacteristic = function* (characteristic) {
	var rc_defer = Q.defer();
	characteristic.read(function (err, data) {
		if (err) {
			error('BLE unable to read characteristic.');
			error(err);
			rc_defer.resolve(null);
		} else {
			rc_defer.resolve(Array.prototype.slice.call(data));
		}
	});
	return yield rc_defer.promise;
}

// module.exports.Central.prototype.writeCharacteristic = function* (characteristic, data) {
b.writeCharacteristic = function* (characteristic, data) {
	var wc_defer = Q.defer();
	characteristic.write(new Buffer(data), false, function (err) {
		if (err) {
			error('BLE unable to write characteristic.');
			error(err);
			wc_defer.resolve(err);
		} else {
			wc_defer.resolve(null);
		}
	});
	return yield wc_defer.promise;
}

// module.exports.Central.prototype.notifyCharacteristic = function (characteristic, notification) {
b.notifyCharacteristic = function (characteristic, notification) {
	characteristic.notify(true, function (err) {
		if (err) {
			error('BLE unable to setup notify for characteristic.');
			error(err);
			return err;
		} else {
			info('setup ble notification callback')
			characteristic.on('data', function (data) {
				lib.callFn(notification, Array.prototype.slice.call(data));
			});
		}
	});
}


	return yield defer.promise;
}
