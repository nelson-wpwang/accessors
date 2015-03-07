#!/usr/bin/env python3

from socketserver import BaseRequestHandler, ThreadingMixIn, UDPServer, TCPServer
import threading
import random
import time

get_and_incr_lock = threading.Lock()
get_and_incr_cnt = -1
def get_and_incr():
	with get_and_incr_lock:
		global get_and_incr_cnt
		get_and_incr_cnt += 1
		return get_and_incr_cnt

class ThreadingUDPServer(ThreadingMixIn, UDPServer): pass
class ThreadingTCPServer(ThreadingMixIn, TCPServer): pass
ThreadingTCPServer.allow_reuse_address = True

class UDPEchoRequestHandler(BaseRequestHandler):
	def handle(self):
		req = get_and_incr()
		data = bytes(str(req) + ': ', 'utf-8') + self.request[0]
		socket = self.request[1]
		print("UDP. {}".format(data))
		delay = random.randrange(50,300) / 100
		print("UDP.   Delay request {} for {}".format(req, delay))
		time.sleep(delay)
		socket.sendto(data, self.client_address)
		print("UDP. Request {} done.".format(req))

class TCPEchoRequestHandler(BaseRequestHandler):
	def handle(self):
		req = get_and_incr()
		data = bytes(str(req) + ': ', 'utf-8') + self.request.recv(1024)
		print("TCP. {}".format(data))
		delay = random.randrange(50,300) / 100
		print("TCP.   Delay request {} for {}".format(req, delay))
		time.sleep(delay)
		self.request.sendall(data)
		print("TCP. Request {} done.".format(req))

if __name__ == '__main__':
	udp_server = ThreadingUDPServer(('localhost', 11111), UDPEchoRequestHandler)
	udp_server_thread = threading.Thread(target=udp_server.serve_forever)
	udp_server_thread.daemon = True
	udp_server_thread.start()
	print("UDP Echo Server running.")

	tcp_server = ThreadingTCPServer(('localhost', 22222), TCPEchoRequestHandler)
	tcp_server_thread = threading.Thread(target=tcp_server.serve_forever)
	tcp_server_thread.daemon = True
	tcp_server_thread.start()
	print("TCP Echo Server running.")

	udp_server_thread.join()
	tcp_server_thread.join()
