Accessors
=========

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
with names. Each element can be an input, output, or both.

- **Input**: Accepts an action or data from the user but can only send that
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
whenever their input value changes.

Accessor Runtime
----------------

Accessors are run inside of a common accessor runtime, as described in
`runtimes/README.md`. The runtime is responsible for presenting the accessor
and calling accessor functions. The runtime also provides abstractions about
the execution environment, such as logging and socket access.

Accessor Example
----------------

Continuing with the media player example, let's add a new device-specific
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

Port and Interfaces
-------------------



To make creating accessors easier and to aid in discovering accessors, they
can be compiled in a hierarchical fashion to avoid redundancy and create
structure. We use a folder based tree to provide structure. For example:

```
                OnOffDevice
               /         \
            Light        VideoDisplay
            /               \
          Hue             Projector
                              \
                            Panasonic Projector
```

This allows someone using accessors to control all projectors without knowing
that there was a particular one made by Panasonic nearby. It also allows
for inheriting interface elements. For example, the OnOffDevice interface
provides the "Power" control, so that all lights and projectors don't need
to copy it. Each subsequent interface must only provide more detailed
interfaces.


