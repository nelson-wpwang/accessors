#!/usr/bin/env node

var accessors = require('accessors.io');

accessors.create_accessor('/tests/udp_echo', null, function (udp_echo) {
	udp_echo.Message.input("hello world", function () {
		udp_echo.Response.output(function (resp) {
			console.log("resp: " + resp);
			setTimeout(function () {
				udp_echo.Response.output(function (resp) {
					console.log("resp: " + resp);
				});
			}, 3100);
		});
	});
});

