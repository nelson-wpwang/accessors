Runtimes
========

The accessor runtime defines the computation environment that accessors are
run in. The runtime is responsible for calling accessor methods, providing
access to accessor parameters, and providing access to host resources (e.g. a
reasonable `print` mechanism).

**This document describes accessor runtime version 0.2, which is subject to
change until its formal release.**

__Table of Contents__

1. [Accessor Lifecycle](#accessor-lifecycle)
1. [Synchronizing Asynchronous Events](#synchronizing-asynchronous-events)
1. [Runtime Functions](#runtime-functions)
  - [Accessor Framework Functions](#accessor-framework-functions)
  - [General Utility](#general-utility)
  - [Time](#time)
  - [Sockets](#sockets)
  - [HTTP Requests](#http-requests)
  - [CoAP Requests](#coap-requests)
  - [WebSockets](#websockets)
  - [RabbitMQ / AMQP](#rabbitmq--amqp)
  - [GATD v0.1](#gatd-v01)
  - [Text To Speech](#text-to-speech)
  - [BLE](#ble)
  - [Encoding Functions](#encoding-functions)
  - [Color Functions](#color-functions)



Accessor Lifecycle
------------------

In order to start an accessor, its `init` method must be called. No other
accessor functions may be called until `init` has returned. If `init` fails
for some reason, and the accessor will not be able to function, the function
MUST `throw` an exception to signal the error.
Upon failure, the accessor is unloaded. The `wrapup`
function is *not* called if `init` fails.

During runtime, any accessor function may be called at any time. Multiple
calls to accessor functions are permitted.

Upon termination, the runtime calls `wrapup` (if it is defined). After the call to `wrapup`, no
other accessor functions may be called. The behavior of currently in-flight
functions is undefined. Upon return of `wrapup`, the accessor execution
environment is undefined. It may be destroyed immediately or may languish
indefinitely, accessors should thus be sure to destroy any references to
remote resources before returning from `wrapup`.


Synchronizing Asynchronous Events
---------------------------------

To simplify development, the accessor runtime provides some support for
masking the highly asychronous nature of javascript. In particular, blocking
operations such as network requests that normally require a callback are
tranformed into non-blocking synchronous calls. The allows accessors to write
much simpler code, such as:

```javascript
var s = yield* socket.socket('AF_INET6', 'SOCK_STREAM');
yield* s.connect(('::1', 12345));
s.send('Hello');
var resp = yield* s.recv();
```

In practice, the only impact on the accessor writer is that the accessor must
remember to write `yield*` before any function call that may block. If yield
is omitted, the call will return immediately without actually doing anything.

> For those familiar with C#'s `async` (maps to `function*`) and `await` (maps
> to `yield*`) the principle is very similar. Indeed, the ES7 draft adds the
> `async` and `await` keywords and functionality. In the meantime, the
> functionality is emulated using generators that return promises.


<!-- Meta-Accessors
--------------

Accessors may express dependencies on other accessors, allowing a single
_meta-accessor_ to control both a projector and stereo for example. A
sub-accessor is listed as a dependency with a name and a path to the
sub-accessor. The runtime will make the sub-accessor available as an object in
the meta-accessor runtime. For example, if an accessor listed this dependency:

```javascript
	"dependencies": [
		{
			"path": "/onoffdevice/light/hue/huesingle.json",
			"name": "PatHue"
		}
	]
```

Then in the accessor execution environment, a `PatHue` object can be used as:

```javascript
function* fire() {
	if (typeof PatHue == 'undefined') {
		PatHue = yield* subinit('PatHue', {'BulbName': 'Pat'});
	}
	PatHue.Power(true);
}
```

### `init()`ing sub-accesors

The runtime does **not** automatically init sub-accessors. It is the
responsibility of the meta-accessor (using the `subinit` runtime function).
This is for a few reasons:

* The sub-accessor may not be used and there is no reason to init it until it
   is actually needed.
* The meta-accessor may need to set input values before init is called.
* It provides a mechanism to synchronously set initial values for multiple
  input/inout ports.

The behavoir of any operations on the sub-accessor before calling `subinit`
is undefined. -->


Runtime Functions
-----------------

The accessor runtime provides a library of functions for accessors.
There are primarily I/O functions and serve to abstract the runtime
environment from the accessor.

All accessor libraries must be included with the `require()` function.


### Accessor Setup Functions

To configure the input and outputs of an accessor, the following
functions can be called in the `setup()` function. They allow the accessor
to express its features and dependencies.


- `<void> createPort(<string> name, <array> attributes, <object> options)`:
Create a one-off port for this accessor. Valid attributes:

        'read': The port can be read from. This means that it is capable of
                generating a single output on demand.
        'write': The port can be written to. This makes the port an input
                 that can accept incoming data.
        'event': The port is an output and will generate output data in
                 response to an event. The event is likely not under control
                 of the accessor and will be hard to predict when data will
                 be output.
        'eventperiodic': The port will output data periodically. This is a
                         subtype of 'event'.
        'eventchange': The port will output data when the underlying
                       value the port represents changes. This is a
                       subtype of 'event'.

    Ports may have multiple attributes. For example, a light bulb power port
    may have the `read`, `write`, and `eventperiodic` attributes to signify
    that the light can be controlled, the current state can be queried, and
    the current state will be periodically output.

    Valid options:

        options: {
            display_name: <string> // Nicely formatted name for displays.
            description: <string>  // An overview of what the port does.
            type:        <string>  // One of: button, bool, string, numeric, integer, select, color, object.
            units: <string>        // Port units (if applicable).
            options: <array>       // List of options for the select type.
            min: <numeric>         // If applicable, the minimum value of the port.
            max: <numeric>         // If applicable, the maximum value of the port.
        }

    Options are optional, and the `options` argument can be omitted entirely
    if not used.

- `<void> createPortBundle(<string> name, <array> port_names)`: Group two or more
ports together into a conceptual group. This is useful for ports where setting
only one (or reading only one) doesn't make much sense, that is, they only have
meaning in a group. Creating a port bundle allows the accessor to define
handler functions that will only execute when there is data ready for all
of the ports in the bundle.

- `<void> provideInterface(<string> path)`: Specify that this
accessor implements a particular interface.

- `<accessor> loadDependency(<string> path, <object> parameters)`: Loads a
new accessor as a dependency. Dependencies are guaranteed to exist at
runtime.
   - Dependencies are lazily init-ed, meaning that the dependency's `init`
     method is not called until the first time the dependency is accessed.
   - You may call a dependency's `init` method directly to force immediate
     and predictable initialization.
   - Attempts to call a dependency's `init` method after it has already been
     initialized are (**TODO:** ignored / throw an exception).

### Accessor Core Functions

These can be used inside of an accessor for getting data and for outputing
data.

- `<void> addInputHandler(<string> port_name, <function> handler)`: Define
a function that will be called when the given port receives and new input
data. This is typically called in `init()`.

- `<void> addOuputHandler(<string> port_name, <function> handler)`: Specify
a function to be called when the given port is _read_ from.

- `<string> getParameter(<string> parameter_name)`: Get the value of a
configured parameter that was passed to accessor when it was created. Parameters
are guaranteed to not change during the lifetime of the accessor. Use parameters
for any properties that the accessor needs to assume are constant.

- `<T> get(<string> port_name)`: Get the cached value of an input to a given
port. This is not supported in all runtimes.

- `<void> send(<string> port_name, <T> val)`: Send a value to an ouptut port.
This can be called anytime data is ready for that port.




### Logging

Logging is done by using the common
[console](https://nodejs.org/api/console.html) library.

<!-- - `<string> rt.version(<string> set_to=null)`: The version function returns the
version of the accessor runtime environment running when the call to version
returns.  The optional argument `set_to` will request a change to the accessor
version environment. The version request may include range specifiers (e.g.
`>=2.0.0`). If the requested version change cannot be satisfied, the version
is unchanged and the original version is returned.  The accesor runtime is
versioned using [semantic versioning](http://semver.org/). -->


### Helper

    var helper = require('helper');

- `<void> helper.forEach(<array> arr, <function> callback)`: Typical array
for each function, but it supports both regular functions and generators.

        callback (array_item) { }


<!-- ### Time

- `<float> rt.time.time()`: Returns current time as a unix timestamp.

- _Blocking_ `<null> rt.time.sleep(<int> time_in_ms)`: Suspends execution for at
least the amount of time requested.

- `<null> rt.time.run_later(<float> delay_in_ms, <fn> fn_to_run, <T> args)`:
Schedules `fn_to_run` for execution in the future. -->


### Sockets

All socket related functions are scoped under the `socket` object. The socket
API mirrors the traditional Berkeley sockets API and should look very familiar
to anyone who has used an object-oriented version before (e.g. python's). Note
that __all__ socket operations are blocking.  This is due to the fact that some
runtimes (e.g. a web browser) do not have native socket support and may need to
perform complex operations (e.g. tunnel to a support server).

    var socket = require('socket');

- _Blocking_ `<socket> socket.socket(<string> family, <string> sock_type)`:
This function creates a new socket object. The `family` must be one of the
standard family names (e.g. `AF_INET` or `AF_INET6`) and the `sock_type` must
be a standard socket name (e.g. `SOCK_DGRAM` or `SOCK_STREAM`).

The remaining functions are all members of the returned socket object.

- `void <socket>.bind (<function> callback(<string> message))`:
This function configures a callback to be called when a message is received on
the socket. Note that this function takes no arguments other than the callback.
This means that accessors can only act as clients (they can only bind to
emphemeral ports). This restriction is in place to avoid port conflicts if
multiple devices needed accessor runtime to act as a server on the same port.
Implementations should call `bind` before any methods (`sendto`, `connect`) that
could result in incoming data to ensure that data is not dropped.

**TODO:** How should data be passed into the send/recv functions? Perhaps they
should use [blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob)?
- _Blocking_ `void <socket::udp>.sendto (<string> message, [<string> host, <int> port])`:
This method is only valid for `SOCK_DGRAM` sockets. It sends the message to the
specified host.

- _Blocking_ `void <socket::tcp>.connect([<string> host, <int> port])`:
Open a TCP connection to the specified host.

- _Blocking_ `void <socket::tcp>.send(<string> message)`:
Send data on an open TCP connection. It is an error to call `send` before
calling `connect`.


### HTTP Requests

Make HTTP requests as a client

    var http = require('httpClient');

- _Blocking_ `<IncomingMessage> http.get(<string> url)`: GET a URL.
The response object has these attributes: `statusCode`, `statusMessage`,
and `body`.

- _Blocking_ `<IncomingMessage> http.post(<string> url, <string> body)`: HTTP POST.

- _Blocking_ `<IncomingMessage> http.put(<string> url, <string> body)`: HTTP PUT.

- _Blocking_ `<string> http.request(<object> options)`: See the
[request](https://github.com/request/request#requestoptions-callback)
module for details.

### CoAP Requests

    var coap = require('coapClient');

- _Blocking_ `<string> coap.get(<string> url)`: Create a CoAP get request
to the specified URL.

- _Blocking_ `<string> coap.post(<string> url, <string> body)`: POST via
CoAP to a specified resource.

- `<void> coap.observe(<string> url, <function> callback)`: Connect to an
observe port and call `callback` every time new data is available.


### WebSockets

    var ws = require('webSocket');

See [node ws module](https://github.com/websockets/ws) for documentation.



### RabbitMQ / AMQP

- _Blocking_ `<amqp_connection> amqp.connect(<string> url)`: Connect
to an AMQP server will a fully defined AMQP URL.

- `<void> [amqp_connection].subscribe(<string> exchange, <string> routing_key, <function> callback)`:
Create a queue from a RabbitMQ exchange with the given routing key call `callback`
with all incoming data packets.


### GATD v0.1

For older versions of GATD that support older socket.io.

- _Blocking_ `<socketio_connection> gatd_old.connect(<string> url)`: Connect
to a socket.io server (0.9).

- `<void> [socketio_connection].query(<object> query, <function> callback)`:
Query the GATD streamer with the given query and call `callback` will all
returned data packets.


### Text to Speech

    var tts = require('textToSpeech');

- _Blocking_ `<void> tts.say(<string> text)`: Will read the given text aloud


### BLE

Bluetooth Low Energy support.

    var ble = require('ble');

- _Blocking_ `<ble> ble.Client()`: Create a new device that can be a BLE
master.

- `<void> [ble].stayConnected(<string> uuid, <string> name, <string> mac_address, <function> on_connect(<peripheral>), <function> on_disconnect, <function> on_error)`: Find
and stay connected to a device. Each time the device connects, `on_connect`
will be called. Similarly, `on_disconnect` will be called anytime the device
disconnects.

- `<void> [ble].scan(<array> uuids, <string> name, <string> mac_address, <function> callback(<peripheral>))`: Start a BLE scan for the listed
UUIDs, name, or MAC address. An empty UUID array will look for all devices.
UUIDs should be specified
as lowercase hex without dashes. When a matching device is found,
`callback(peripheral)` will be called.

- `<void>` [ble].scanStop()`: Stop a BLE scan.

- _Blocking_ `<err> [ble].connect(<peripheral> p, [<function> on_disconnect])`:
Connect to a given peripheral. On success, `err == null`. You may pass an
optional callback which will be called if the device disconnects.

- _Blocking_ `<err> [ble].disconnect(<peripheral> p)`: Disconnect from a peripheral.
`err == null` if it succeeds.

- _Blocking_ `<services> [ble].discoverServices(<peripheral> p, <array> uuids)`:
Find all services that a given peripheral provides that match the uuids provided.
`uuids` may be an empty array to match all services.

- _Blocking_ `<characteristics> [ble].discoverCharacteristics(<service> s, <array> uuids)`:
Find all characteristics as a part of the service. `uuids` follows the same
pattern as the other functions.

- _Blocking_ `<bytearray> [ble].readCharacteristic(<characteristic> c)`:
Read a device's characteristic.

- _Blocking_ `<err> [ble].writeCharacteristic(<characteristic> c, <bytearray> data)`:
Write the array of bytes to the given characteristic. `err == null` on success.

- _Blocking_ `<err> [ble].notifyCharacteristic(<characteristic> c, <function> callback)`:
Configure the characteristic to notify on data change. Each updated
data value will sent to `callback (<bytearray> data)`.

### Encoding Functions

Various devices may need data in a variety of encodings. These functions help
convert between them.

- `<string> encode.atob(<base64> str)`: Decode a base64 encoded string.

- `<base64> encode.btoa(<string> str)`: Encode a string in the base64 format.


### Color Functions

When writing accessors that use colors (such as lighting) it may be useful
to change colors between various color representations. The `color` object
makes this easier.

- `<hsv object> color.hex_to_hsv(<string> hex_color)`: Convert a hex color
string (like "0000FF") to an HSV object (like
`{h: [hue (0-360)], s: [saturation (0-1)], v: [value (0-1)]}`).

- `<string> color.hsv_to_hex(<hsv object> hsv_color)`: Convert an HSV object
to an RGB hex string.

