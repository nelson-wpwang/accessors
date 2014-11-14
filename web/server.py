#!/usr/bin/env python3

import flask
import requests

ACCESSOR_SERVER = 'http://memristor-v1.eecs.umich.edu:6565'


app = flask.Flask(__name__, template_folder='jinja')


@app.route('/location/<path:location>')
def location(location):
	print(location)

	# Get the list of valid accessors for the given location
	r = requests.get('{}/accessors/{}/accessors.json'.format(ACCESSOR_SERVER, location))
	if r.status_code != 200:
		return flask.jsonify(**{'status': 'error'})

	accessor_list = r.json()

	accessors = {'accessors': []}

	for accessor_url in accessor_list['accessors']:
		r2 = requests.get('{}/accessor{}'.format(ACCESSOR_SERVER, accessor_url))
		if r2.status_code == 200:
			accessor = r2.json()
			accessor['html'] = flask.render_template('ports.jinja', accessor=accessor)
			accessors['accessors'].append(accessor)


	return flask.jsonify(**accessors)


@app.route('/accessor')
def accessor():

	locations = []
	locations.append({'name': 'University of Michigan - 4908 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/4908'})

	return flask.render_template('accessors.jinja', locations=locations)


app.run(host='0.0.0.0', debug=True)