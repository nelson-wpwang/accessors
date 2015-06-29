#!/usr/bin/env node

var accessors = require('accessors.io');

accessors.create_accessor('/tests/tcp_echo', null, function (tcp_echo) {
	tcp_echo.Message.input("hello world", function () {
		tcp_echo.Response.output(function (resp) {
			console.log("resp: " + resp);
			setTimeout(function () {
				tcp_echo.Response.output(function (resp) {
					console.log("resp: " + resp);
				});
			}, 3100);
		});
	});
});
