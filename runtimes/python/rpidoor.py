#!/usr/bin/env python3

import sh

import accessors

import logging
logging.getLogger('accessors').setLevel(logging.DEBUG)

password = input("What's the password? ")

#rpidoor = accessors.get_accessor_by_location(
#	'localhost:6565',
#	'University of Michigan - 4908 BBB',
#	'rpidoor'
#	)
rpidoor = accessors.get_accessor(
		'/lock/door/rpidoor',
		{
			'host': '2607:f018:800:10f:c298:e552:5048:d86e',
			'password': password,
		},
		)

rpidoor.Lock = False

