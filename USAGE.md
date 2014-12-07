Getting the Accessor Environment Setup
======================================

There are a couple pieces in the accessor framework.
Each plays a specific role in getting accessors to work.

Initial Setup
-------------

A decent portion of the accessor code runs in Python3. Make sure you have
python 3.4+ installed then run

    sudo pip3 install -r requirements.txt

to get all the necessary Python3 packages installed. You may need to change
the name of `pip3` based on which platform you are on.


Accessor Host Server
--------------------

The accessor host server is an HTTP server that provides the accessors that can
be run in an accessor runtime. The host server also servers lists of accessors
that are valid in a give location.

The accessor host server is located in the `/server` folder. To run it with
the accessors and locations in this repo:

    cd server
    ./accessor_host.py -p ../accessors -l ../locations

See `./server/README.md` for more information on how to interact with the
accessor host server.


Accessor Runtimes
-----------------

Runtimes are where accessors are run. They provide the necessary support
libraries (http, socket, etc.) to allow accessors to interact with the world.

There are a couple in this repository.


### Accessor Web Runtime

The web runtime allows you to use accessors inside of a browser. The web
runtime has two parts: a webserver that hosts the HTML pages and retrieves
accessor files and the in-browser javascript runtime.

Setting up the webserver requires two servers to be running. The first is a
websockets server. This is used by the javascript runtime to tunnel UDP and
TCP sockets over websockets since browsers do not allow arbritrary socket
connections. To start this:

    ./ws_server.py

The next is the HTTP server that hosts the accessor pages. To run this:

    ./server.py -s localhost:6565 -w localhost:8765

Note this server requires [Bower](http://bower.io/) to be installed.

Now `localhost:5000` should run the accessor server.



### Accessor Python Runtime



### Accessor Java Runtime
