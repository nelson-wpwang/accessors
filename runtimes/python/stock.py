#!/usr/bin/env python3

import accessors

# First step is to get a "StockTick" object. This is an object that
# encapsulates the accessor so that we can interact with it
stocktick = accessors.get_accessor('/webquery/StockTick')

for symbol in ['GOOG', 'MSFT', 'YHOO']:
	# The StockTick accessor has two ports: "StockSymbol" and "Price".

	# Accessor ports have associated directions: input, output, and observe.
	# Assignments to a port map to input and reads from a port map to output.
	# (Look bitcoin for an example of observe)

	# To use the StockTick accessor, we first set the StockSymbol:
	stocktick.StockSymbol = symbol

	# The we read the Price of the stock:
	print("Stock {} price {}".format(symbol, stocktick.Price))
