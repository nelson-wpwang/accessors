#!/usr/bin/env python3

import sh

import accessors

stocktick = accessors.get_accessor_by_location('localhost:6565', 'Anywhere', 'StockTick')
try:
	for symbol in ['GOOG', 'MSFT', 'YHOO']:
		stocktick.StockSymbol = symbol
		print("Stock {} price {}".format(stocktick.StockSymbol, stocktick.Price))
finally:
	# Hack until I understand bond better
	sh.killall('node')
