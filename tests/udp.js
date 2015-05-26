#!/usr/bin/env node

var accessors = require('accessors')('http://localhost:6565');

accessors.create_accessor('/tests/udp_echo', null, function (udp_echo) {
	udp_echo.Message("hello world");
});
