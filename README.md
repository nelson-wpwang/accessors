Accessors
=========

Accessors are a method for abstracting the complicated and diverse input/output
interfaces present in real-world devices and systems. Accessors allow for
bundling standardized interfaces to common devices (lights, audio equipment,
sensors, doors, etc.) with actual code that can access these interfaces.
This abstraction allows for higher level applications to interact with the
physical world without having to directly interface with the myriad of
protocols present in real-world devices.

More concretely, accessors are JSON files that contain both an interface
and code. The interface is specified much like HTML forms are: as a series
of I/O elements with names. Each element can be an input, output, or both.

- **Input**: Accepts an action or data from the user but can only send that
to the device being accessed. There is no state that can then be displayed to
the user. A simple example is the "seek" button on audio equipment. It is
entirely an input control action to the system.

- **Output**: Displays the state of the device being accessed. Keeping with
the audio example, the current song being played is a good example of an output,
providing it cannot be changed.

- **Input/Output**: An element that can do both. For instance, the volume level
can both be set (an input) or queried (output of an accessor).

Following the interface and other meta information (name, author, etc.),
is a block of code that allows whatever system is using the accessor to actually
do something with the interface elements. There are three required functions
that must be instantiated (even if they are empty): `init()`, `fire()`, and
`wrapup()`.

- **`init()`**: `init()` is called when the accessor is first loaded. Any
preliminary code should be put here. Also, it may be useful to prepopulate the
output and i/o fields to show the user.

- **`fire()`**: `fire()` is responsible for performing all actions. The function
must act on all fields either by querying the state of the device or sending
the user-configured data to the device. The accessor runtime (the system
that has loaded the accessor) can assume that calling `fire()` will completely
synchronize the accessor with the device.

- **`wrapup()`**: `wrapup()` performs any cleanup when the accessor is unloaded.

Further, to provide a more responsive accessor and to reduce overhead, the
accessor may also specify functions for each of the input and i/o interface
elements. These functions are responsible for performing an action when its
corresponding interface element has changed.


Accessor Example
----------------

The following is the structure of an accessor for a light bulb.

```
{
  "accessor": {
    "name":    "Light Bulb",
    "version": "0.1",
    "author":  "General Electric",
    "description": "
Light Bulb
=======================

Turn a light bulb on and off.
",

    "ports": [
              {
                "direction": "inout",
                "name":      "Power",
                "type":      "bool"
              }
    ],

    "code": {
              "language": "javascript",
              "code": "

function init () {
// Not needed
}

function Power (power_setting) {
  switch_light_bulb(power_setting);
}

function fire (input_setting_choice) {
  Volume(get("Power"));
}

function wrapup () {
// Not needed
}
"
    }

  }
}
```

Accessor Hierarchy
------------------

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


