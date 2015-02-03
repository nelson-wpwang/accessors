var request = require('request');

var options = {
	url: 'http://127.0.0.1:11111/empty.txt',
};

t1 = process.hrtime();
request(options, function (error, response, body) {
	console.log("q1: " + process.hrtime(t1)[1]);
	t2 = process.hrtime();
	request(options, function (error, response, body) {
		console.log("q2: " + process.hrtime(t2)[1]);
		t3 = process.hrtime();
		request(options, function (error, response, body) {
			console.log("q3: " + process.hrtime(t3)[1]);
			t4 = process.hrtime();
			request(options, function (error, response, body) {
				console.log("q4: " + process.hrtime(t4)[1]);
				t5 = process.hrtime();
				request(options, function (error, response, body) {
					console.log("q5: " + process.hrtime(t5)[1]);
				});
			});
		});
	});
});

/* Wow, the built-in http is *SLOW*, okay...

var http = require('http');

var options = {
	host: 'localhost',
	port: '11111',
	path: 'empty.txt'
};

t1 = process.hrtime();
http.request(options, function() {
	console.log(process.hrtime(t1)[1]);
	t2 = process.hrtime();
	http.request(options, function() {
		console.log(process.hrtime(t2)[1]);
	}).end();
}).end();

*/
