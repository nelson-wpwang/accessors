#!/usr/bin/env python3

import asyncio
import os

import aiohttp.web

WEBPAGE = '''
<html>
  <head>
	<title>Color Led!</title>
  </head>

  <body id="b">

<script type="text/javascript">
var w;

function init () {
	w = websocket = new WebSocket('ws://localhost:8765/');
	w.onopen = function (evt) {
		console.log('opened');
	}
	w.onmessage = function (evt) {
		console.log(evt.data);

		document.getElementById("b").style.backgroundColor = evt.data;
	}
}

init();
</script>

  </body>
</html>
'''

@asyncio.coroutine
def colorhandler(request):

	post_params = yield from request.post()

	if 'color' in post_params:
		request.app['color'] = post_params['color']

		for ws in request.app['sockets']:
			ws.send_str(post_params['color'])

	return aiohttp.web.Response(body='success'.encode(), content_type='text/plain')


@asyncio.coroutine
def wshandler(request):
	resp = aiohttp.web.WebSocketResponse()
	ok, protocol = resp.can_start(request)
	if not ok:
		return aiohttp.web.Response(body=WEBPAGE.encode(), content_type='text/html')

	resp.start(request)
	request.app['sockets'].append(resp)

	resp.send_str(request.app['color'])

	while True:
		msg = yield from resp.receive()

		if msg.tp != aiohttp.web.MsgType.text:
			break

	request.app['sockets'].remove(resp)
	print('Someone disconnected.')

	return resp


@asyncio.coroutine
def init (loop):
	app = aiohttp.web.Application(loop=loop)
	app['sockets'] = []
	app['color'] = '445566'

	app.router.add_route('GET', '/', wshandler)
	app.router.add_route('POST', '/color', colorhandler)

	handler = app.make_handler()
	srv = yield from loop.create_server(handler, 'localhost', 8765)
	return app, srv, handler

@asyncio.coroutine
def finish (app, srv, handler):
	for ws in app['sockets']:
		ws.close()

	app['sockets'].clear()
	yield from asyncio.sleep(0.1)
	src.close()
	yield from handler.finish_connections()
	yield from srv.wait_closed()


loop = asyncio.get_event_loop()
app, srv, handler = loop.run_until_complete(init(loop))
try:
	loop.run_forever()
except KeyboardInterrupt:
	loop.run_until_complete(finish(app, srv, handler))
