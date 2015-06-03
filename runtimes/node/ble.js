var debug_lib = require('debug');

var lib       = require('lib');

var noble     = require('noble');
var Q         = require('q');

var debug = debug_lib('accessors:ble:debug');
var info  = debug_lib('accessors:ble:info');
var warn  = debug_lib('accessors:ble:warn');
var error = debug_lib('accessors:ble:error');

var poweredOn = false;

module.export.Central = function* () {

	if (!poweredOn) {
		info('BLE waiting for powered on');
		var defer = Q.defer();
		noble.on('stateChange', function (state) {
			info('BLE state change: ' + state);
			if (state === 'poweredOn') {
				poweredOn = true;
				defer.resolve(b);
			} else if (state === 'poweredOff') {
				error('BLE appears to be disabled.');
				defer.resolve(null);
			}
		});
	} else {
		return b;
	}

	return yield defer.promise;
}



module.export.Central.prototype.scan = function (uuids, callback) {
	info('BLE starting scan');
	noble.on('discover', function (peripheral) {
		lib.callFn(callback, peripheral);
	});

	// Scan for any UUID and allow duplicates.
	noble.startScanning(uuids, true, function (err) {
		if (err) error('BLE: Error when starting scan: ' + err);
	});
};

modul.export.Central.prototype.scanStop = function () {
	noble.stopScanning();
}

module.export.Central.prototype.connect = function* (peripheral, on_disconnect) {
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

module.export.Central.prototype.disconnect = function* (peripheral) {
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

module.export.Central.prototype.discoverServices = function* (peripheral, uuids) {
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

module.export.Central.prototype.discoverCharacteristics = function* (service, uuids) {
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

module.export.Central.prototype.readCharacteristic = function* (characteristic) {
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

module.export.Central.prototype.writeCharacteristic = function* (characteristic, data) {
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

module.export.Central.prototype.notifyCharacteristic = function (characteristic, notification) {
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
