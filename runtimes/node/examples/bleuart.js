var accessors = require('../accessors');

function accessor_create_error (err) {
	if (err) {
		console.error('Error loading accessor: ' + err);
		console.error(err);
		return;
	}
}

accessors.create_accessor('/sensor/BLEUART', null, function (err, bleUart) {
	accessor_create_error(err);

  bleUart.init(function (err) {
    var bleSerial = new BleUart('nordic');

    // optionally define a custom service
    var uart = {
      serviceUUID: '0001',
      txUUID: '0002',
      rxUUID: '0003'
    }
// var bleSerial = new BleUart('foo', uart);

// this function gets called when new data is received from
// the Bluetooth LE serial service:
  bleSerial.on('data', function(data){
    console.log("Got new data: " + String(data));
  });

// this function gets called when the program
// establishes a connection with the remote BLE radio:
  bleSerial.on('connected', function(data){
  console.log("Connected to BLE. Sending a hello message");
  bleSerial.write("Hello BLE!");
  //bleSerial.write([1,2,3,4,5]);
  //bleSerial.write(new Uint8Array([5,4,3,2,1]));
  //bleSerial.write(new Buffer([6,7,8,9]))
  });

// thus function gets called if the radio successfully starts scanning:
  bleSerial.on('scanning', function(status){
    console.log("radio status: " + status);
  });





});

});
