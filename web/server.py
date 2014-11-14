#!/usr/bin/env python3

import flask


app = flask.Flask(__name__, template_folder='jinja')


@app.route('/accessor')
def accessor():

	locations = []
	locations.append({'name': 'University of Michigan - 4908 BBB',
	                  'path': '/usa/michigan/annarbor/universityofmichigan/bbb/4908'})

	return flask.render_template('accessors.jinja', locations=locations)


app.run(host='0.0.0.0', debug=True)