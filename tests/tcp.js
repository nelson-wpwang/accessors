#!/usr/bin/env node

var accessors = require('accessors')('http://localhost:6565');

accessors.create_accessor('/tests/tcp_echo', null, function (tcp_echo) {
	tcp_echo.Message("hello world");
});
