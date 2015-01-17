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

