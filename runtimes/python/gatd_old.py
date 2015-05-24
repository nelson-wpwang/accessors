#!/usr/bin/env python3

import accessors
import logging
logging.getLogger('accessors').setLevel(logging.DEBUG)

parameters = {
	'gatd_url': 'fram.eecs.umich.edu',
	'gatd_query': '{"profile_id": "YWUr2G8AZP"}',
}

gatd = accessors.get_accessor('/webquery/GatdOld', parameters)

gatd.observe('Data', lambda observation:
		print("Data: {}".format(observation))
		)

accessors.observe_forever()

