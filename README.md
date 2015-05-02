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

Accessor Runtime
----------------

Accessors are run inside of a common accessor runtime, as described in
`runtimes/README.md`. The runtime is responsible for presenting the accessor
and calling accessor functions. The runtime also provides abstractions about
the execution environment, such as logging and socket access.

Accessor Example
----------------

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

function* power(onoff) {
	params = {'power': onoff};
	url = get_parameter('url') + '/api/' + get_parameter('api_key') + '/state';
	yield* rt.http.request(url, 'PUT', null, rt.json.stringify(params), 3000);
	set('/av/audiodevice.Power', true);
}

function* next_track() {
	if (get('/av/audiodevice.Power') != true) {
		power(true);
	}
	params = {'next_track': true};
	url = get_parameter('url') + '/api/' + get_parameter('api_key') + '/action';
	resp = yield* rt.http.request(url, 'PUT', null, rt.json.stringify(params), 3000);
	resp = rt.json.from_string(resp);
	set('/av/audiodevice.NowPlaying', resp.track);
}

function* Skip15() { ... }
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
                "direction": "inout",
                "name":      "Power",
                "type":      "bool"
              },
              {
                "direction": "input",
                "name":      "Seek",
                "type":      "button"
              },
              {
                "direction":    "output",
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

Ports and Interfaces
--------------------

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



Getting Started
---------------

There's a lot going on in this accessors repository and a few different
components.

### Folder Structure Overview

- `/accessors`: This holds the accessor `.js` files.
- `/android`: Android apps. Not extensively used.
- `/applications`: Various applications that use accessors.
- `/groups`: Organized collections of devices and the accessors that each
device uses. This may be deprecated in the future.
- `/interfaces`: Collections of ports that accessors may expose.
- `/runtimes`: Execution environments in different languages for accessors.
- `/server`: The Accessor Host Server that provides the full JSON/XML versions
of accessors.
- `/tests`: Test code, not used currently.


### Running a web interface for accessors


1. Run the Accessor Host Server. This is a webserver that parses the raw
JavaScript accessors, converts them to the full JSON representation, and serves
them to any interested clients.

        cd server
        ./accessor_host.py

2. Run the RPC example application. This instantiates an Accessor Runtime (in
Node.js) where accessors execute. It then makes the ports accessible via a RESTful
web API.

        cd applications/node-rpc
        ./rpc.js

3. Run a front-end to the RPC application. This provides a web interface for
interacting with the accessors running in the RPC server.

        cd applications/rpc-frontend
        ./server.py

4. Go to [http://localhost:5000](http://localhost:5000). You can now interact
with the accessors that were loaded in the RPC runtime.





