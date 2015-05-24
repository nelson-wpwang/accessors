Node.js RPC Web Server
======================

This application loads accessors and exposes their ports as an HTTP interface.
Setting ports (inputs) for an accessor maps to POST requests and reading ports (outputs)
maps to GET requests.

Accessors are loaded from groups.

URL Structure
-------------

    http://server.com/<group>/<device name>/<port>

Example:

    http://server.com/misc/mycolor/umhue01/onoff/Power


Install From npm
----------------

    sudo npm install -g --unsafe-perm accessors.io-rpc

The `--unsafe-perm` flag allows the bower dependencies to be installed.

Run it:

    accessors-rpc

Then browse to [http://localhost:5000](http://localhost:5000).

Running Locally
---------------

    npm install
    sudo npm install -g bower
    cd static
    bower install
    cd ..
    ./rpc.js
