Accessors
=========

[![Code Climate](https://codeclimate.com/github/lab11/accessors/badges/gpa.svg)](https://codeclimate.com/github/lab11/accessors)

Accessors are a method for abstracting the complicated and diverse input/output
interfaces present in real-world devices and systems. Accessors allow for
bundling standardized interfaces to common devices (lights, audio equipment,
sensors, doors, etc.) with actual code that can access these interfaces.
This abstraction allows for higher level applications to interact with the
physical world without having to directly interface with the myriad of
protocols present in real-world devices.

More concretely, accessors are Javascript files that both describe an
interface and supply code to use it. The Javascript is parsed to generate JSON
(and XML) objects that express accessor capabilities and requirements.
Accessors present an interface much like HTML forms: a series of I/O elements
with names.

<!-- - **Input**: Accepts an action or data from the user but can only send that
to the device being accessed. There is no state that can then be displayed to
the user. A simple example is the "seek" button on audio equipment. It is
entirely an input control action to the system.

- **Output**: Displays the state of the device being accessed. Keeping with
the audio example, the current song being played is a good example of an output,
providing it cannot be changed.

- **Input/Output**: An element that can do both. For instance, the volume level
can both be set (an input) or queried (output of an accessor).

Following the interface and other meta information (name, author, etc.), is a
block of code that allows whatever system is using the accessor to actually do
something with the interface elements. There are two meta-functions, `init()`
and `wrapup()`, that run when an accessor is instantiated and destroyed
respectively. Input (and inout) ports define port functions that are called
whenever their input value changes. -->


__Repository__

1. [Applications](/applications): Various applications or tools that are
part of the accessor ecosystem.
  - [Blocks](/applications/central): Application for creating applications
  with accessors by connecting blocks.
  - [Command Line Interface](/applications/node-cli): Download and interact
  with accessors using a command line interface.
  - [Accessor RPC Host](/applications/node-rpc): Execute accessors on a server
  and provide a REST API for interacting with the accessors.
  - [Accessor RPC Frontent](/applications/rpc-frontent): GUI for interacting
  with the RPC server.
1. [Runtimes](/runtimes): Execution environments that can run accessors.
  - [Node Runtime](/runtimes/node): Node.js based runtime for accessors.
  - [Python Runtime](/runtimes/python): Python based runtime for accessors.
1. [Host Server](/server): Server that describes and hosts accessors.


__Table of Contents__

1. [Example](#example)
1. [Accessors.io](#accessorsio)
1. [Command Line Tool](#command-line-tool)
1. [Accessor Background](#accessor-background)
1. [Accessors RPC Tool](#accessors-rpc-tool)
  - [Accessor Runtime](#accessor-runtime)
  - [Accessor Example](#accessor-example)
  - [Ports and Interfaces](#ports-and-interfaces)



Dependencies
------------

We highly recommend you use [io.js](https://iojs.org) with this project
as it has better support for newer Node.js features that we use.


Example
-------

Accessors can be used to not only communicate with devices, but also with
web services. To see the Node.js accessor runtime query a stock price, run:

    cd runtimes/node
    npm install
    cd examples
    ./stock.js

This should print out the Microsoft stock price.

The code looks like this:

```javascript
var accessors = require('accessors.io');

// First step is to create a live "StockTick" accessor. This will execute
// the accessor so we can interact with it.
accessors.create_accessor('/webquery/StockTick', {}, function (accessor) {
  // The StockTick accessor, has two ports: "StockSymbol" and "Price".
  // To get a quote, we first set the StockSymbol port by calling the
  // "input" function on the port.
  accessor.StockSymbol.input('MSFT', function () {
    // After that has been set, we call the "output" function on the
    // Price port to get the current price.
    accessor.Price.output(function (price) {
      console.log('MSFT stock price: $' + price);
    });
  });
},
// Handle any errors that may occur when creating the accessor.
function (error) {
  console.log('Error loading accessor.');
  console.log(error);
});
```

The "StockTick" accessor is created, then its two ports are used to set
the stock being queried and to read its price.

There are other examples in that folder that you can explore.


Accessors.io
------------

Accessors must be hosted somewhere, and we currently run a hosting server
at [accessors.io](http://accessors.io). In a browser, this service will list
the existing accessors and show the details of each one. For more information
and for running your own hosting server, see the [Host Server Readme](/server).



Command Line Tool
-----------------

To test out an accessor you can use the command line interface tool.

    sudo npm install -g accessors.io-cli
    accessors.io-cli



Accessors RPC Tool
------------------

The accessor remote proceedure tool allows a server to run accessors and provides
a browser interface to those accessors.
See the [RPC Server](/applications/node-rpc) and
[RPC Frontend](/applications/rpc-frontend) for how to use it.



Accessor Background
-------------------

### Accessor Runtime

Accessors are run inside of a common accessor runtime, as described in
`runtimes/README.md`. The runtime is responsible for presenting the accessor
and calling accessor functions. The runtime also provides abstractions about
the execution environment, such as logging and socket access.

### Accessor Example

Consider a media player example, let's add a new device-specific
feature "Skip 15 seconds" and look at an example accessor and its generated JSON:

```javascript
// name: Network Stereo
// author: Network Stereos Inc.
// email: netstereo@example.com
//
// Network Stereo
// ==============
//
// An example accessor for a networked stereo.

function init() {
	provide_interface('/av/audiodevice', {
		'/av/audiodevice.Power': power,
		'/av/audiodevice.Seek': next_track,
		[...]
		});
	create_port('input', 'Seek15', {
		type: 'button',
		display_name: 'Skip Forward 15 Seconds'
	});
}

power.input = function* (onoff) {
	params = {'power': onoff};
	url = get_parameter('url') + '/api/' + get_parameter('api_key') + '/state';
	yield* rt.http.request(url, 'PUT', null, rt.json.stringify(params), 3000);
}

next_track.input = function* () {
	if (get('/av/audiodevice.Power') != true) {
		power(true);
	}
	params = {'next_track': true};
	url = get_parameter('url') + '/api/' + get_parameter('api_key') + '/action';
	resp = yield* rt.http.request(url, 'PUT', null, rt.json.stringify(params), 3000);
	resp = rt.json.from_string(resp);
}

Skip15.input = function* () { ... }
```

The JavaScript file gets expanded to a full JSON representation as shown:

```json
{
  "accessor": {
    "name":    "Network Stereo",
    "version": "0.1",
    "author":  {"name": "Network Stereos Inc.", "email": "netstereo@example.com"},
    "description": "
Network Stereo
==============

An example accessor for a networked stereo.
",
    "dependencies": [],
    "runtime_imports": ["http", "json"],
    "ports": [
              {
                "directions": ["input", "output"],
                "name":       "Power",
                "type":       "bool"
              },
              {
                "directions": ["input"],
                "name":       "Seek",
                "type":       "button"
              },
              {
                "directions":   ["output"],
                "name":         "NowPlaying",
                "display_name": "Now Playing",
                "type":         "string"
              }
    ],

    "code": "
              [ the above javascript ]
    "
  }
}
```

### Ports and Interfaces

Interfaces are a global ontology for devices. That is, they attempt
to take all the capabilities of all devices and map them into a single, unified
API. A key insight of our interface design is treating extensions as aliases.

Consider, many devices fall into the simple category of `/onoff` devices, which
expose a `Power(bool)` capability. The basic `/lighting/light` interface
`extends /onoff/Power`, and more advanced lights such as `/lighting/dimmable`
`extends /lighting/light`. When an accessor for a dimmable light
`provides /lighting/dimmable`, the geo-fencing app that turns off all of your
home appliances (all `/onoff/Power`), the home automation service that turns off
all your lights (`/lighting/light`) when your personal health tracker signals
that you're going to sleep, and the home theater app (`/lighting/dimmable`) that
sets movie mode will all work with your new light.

While composed interfaces may cover the majority of devices, the imperfect
coverage of a standard API impedes its adoption. Consider our stereo example.
If a manufacutrer adds the "Skip 15 seconds" feature to differentiate itself,
but our interfaces do not expose this feature, then the manufacturer is
disincentivized to use our API. To remedy this, we allow accessors to explicitly
`create_port` to expose capabilities not expressed by any interface. This creates
a roadmap towards new interfaces. If a critical mass of devices create the same
port, it motivates the standardization of a new interface, while permitting for
the immediate uptake of new features.
