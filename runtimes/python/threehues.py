#!/usr/bin/env python3

import time

import sh

import accessors

import logging
#logging.getLogger('accessors').setLevel(logging.DEBUG)

hues = accessors.get_accessor_by_location(
	'localhost:6565',
	'University of Michigan - 4908 BBB',
	'Three Hues'
	)
try:
	print("Fair warning, this isn't the fastest right now")
	while True:
		input("Press enter to turn on...")
		hues.Power = True
		input("Press enter to turn off...")
		hues.Power = False
finally:
	# Hack until I understand bond better
	sh.killall('node')
