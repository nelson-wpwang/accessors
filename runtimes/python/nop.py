#!/usr/bin/env python3

import sh

import accessors

import time

t1 = time.time()
print("Start: {} {}".format(t1, 0))

stocktick = accessors.get_accessor_from_server('localhost:6565', '/webquery/Nop')
t2 = time.time()
print("LoadAccessor: {} {}".format(t2, t2-t1))
try:
	stocktick.StockSymbol = 1
	t3 = time.time()
	print("Query1: {} {}".format(t3, t3-t2))

	stocktick.StockSymbol = 2
	t4 = time.time()
	print("Query2: {} {}".format(t4, t4-t3))

	stocktick.StockSymbol = 3
	t5 = time.time()
	print("Query3: {} {}".format(t5, t5-t4))

	stocktick.StockSymbol = 4
	t6 = time.time()
	print("Query4: {} {}".format(t6, t6-t5))
finally:
	# Hack until I understand bond better
	sh.killall('node')
