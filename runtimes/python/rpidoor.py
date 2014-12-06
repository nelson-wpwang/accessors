#!/usr/bin/env python3

import sh

import accessors

rpidoor = accessors.get_accessor_by_location(
	'localhost:6565',
	'University of Michigan - 4908 BBB',
	'rpidoor'
	)
try:
	rpidoor.lock = False
finally:
	# Hack until I understand bond better
	sh.killall('node')
