var coap = require('coap')
var server = coap.createServer({type:'udp6'})

// server.listen(function () {



var b = coap.request('coap://[2607:f018:800:10f:c298:e541:4310:a]/onoffdevice').end()


b.on('response', function (d) {
	console.log(d);
});






// });
