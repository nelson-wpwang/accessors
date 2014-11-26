#!/usr/bin/env python3

import asyncio
import websockets
import json

import socket

import logging
logger = logging.getLogger('websockets.server')
logger.setLevel(logging.DEBUG)
logger.addHandler(logging.StreamHandler())

@asyncio.coroutine
def handler(websocket, path):
	sock = None

	while True:
		msg = yield from websocket.recv()
		logger.debug("> " + str(msg))
		msg = json.loads(msg)

		reply = {
				'type': 'ack',
				'result': 'error',
		}
		if 'packet_id' in msg:
			reply['packet_id'] = msg['packet_id']
		else:
			reply['packet_id'] = -1

		try:
			if msg['type'] == 'handshake':
				if msg['version'] != 0.1:
					raise NotImplementedError("Unknown version: {}".format(msg['version']))
				family = getattr(socket, msg['family'])
				sock_type = getattr(socket, msg['sock_type'])
				sock = socket.socket(family, sock_type)
			elif msg['type'] == 'udp':
				dest = (msg['dest'][0], int(msg['dest'][1]))
				try:
					sock.sendto(msg['bytes'].encode('utf-8'), dest)
				except OSError:
					reply['msg'] = 'Error sending packet'
					raise
			else:
				logger.warn("Unknown message type: {}".format(msg['type']))
				logger.warn(msg)
			reply['result'] = 'success'
		finally:
			reply = json.dumps(reply)
			logger.debug("< " + str(reply))
			yield from websocket.send(reply)

start_server = websockets.serve(handler, None, 8765)
logger.info("Websocket server listening on ws://localhost:8765")

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
