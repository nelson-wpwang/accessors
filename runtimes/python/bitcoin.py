#!/usr/bin/env python3

import accessors
#import logging
#logging.getLogger('accessors').setLevel(logging.DEBUG)

def transaction_callback(transaction):
	print('=== Bitcoin Transaction ===');
	for trans in transaction['x']['inputs']:
		addr = trans['prev_out']['addr']
		btc = float(trans['prev_out']['value']) / 100000000.0
		print('  FROM {}  ({:.6f} BTC)'.format(addr, btc));

	for trans in transaction['x']['out']:
		addr = trans['addr']
		btc = float(trans['value']) / 100000000.0
		print('  TO   {}  ({:.6f} BTC)'.format(addr, btc));

	print('')


Bitcoin = accessors.get_accessor('/webquery/Bitcoin')

value = Bitcoin.Price
print("Bitcoin.Price = {}".format(value))

Bitcoin.observe('Transactions', transaction_callback)

accessors.observe_forever()

