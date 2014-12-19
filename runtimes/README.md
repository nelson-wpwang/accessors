Runtimes
========

The accessor runtime defines the computation environment that accessors are
run in. The runtime is responsible for calling accessor methods, providing
access to accessor parameters, and providing access to host resources (e.g. a
reasonable `print` mechanism).

**This document describes accesor runtime version 0.1, which is subject to
change until its formal release.**


Lifecycle
---------

When an accessor is first loaded, its `init` method is called. No other
accessor functions may be called until `init` has returned. If `init` fails
for some reason, and the accessor will not be able to function, the function
MUST `return false;`. Upon failure, the accessor is unloaded. The `wrapup`
function is *not* called if `init` fails.

During runtime, any accessor function may be called at any time. Multiple
calls to accessor functions are permitted.

Upon termination, the runtime calls `wrapup`. After the call to `wrapup`, no
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
remember to write `yeild*` before any function call that may block. If yeild
is omitted, the call will return immediately without actually doing anything.

> For those familiar with C#'s `async` (maps to `function*`) and `await` (maps
> to `yield*`) the principle is very similar. Indeed, the ES7 draft adds the
> `async` and `await` keywords and functionality. In the meantime, the
> functionality is emulated using generators that return promises.


Meta-Accessors
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
is undefined.


Runtime Functions
-----------------

The accessor runtime provides a small library of functions for accessors.
There are primarily I/O functions and serve to abstract the runtime
environment from the accessor.

All accessor functions are namespaced in the `rt` namespace. This should make
accessors easier to read by clearly identifying which functions are provided
by the accessor runtime and not native javascript or defined in the accessor
itself.

### General Utility

- `<string> rt.version(<string> set_to=null)`: The version function returns the
version of the accessor runtime environment running when the call to version
returns.  The optional argument `set_to` will request a change to the accessor
version environment. The version request may include range specifiers (e.g.
`>=2.0.0`). If the requested version change cannot be satisfied, the version
is unchanged and the original version is returned.  The accesor runtime is
versioned using [semantic versioning](http://semver.org/).

- `<void> rt.log.[debug,info,warn,error](<string> line)`: The log family
of functions provides a means for logging messages. These messages are
generally intended for developers and should not be used to convey runtime
information.

- `<void> rt.log.critical(<string> line)`: A critical error will throw a runtime
exception, terminating the current execution. Do not use critical for transient
errors (e.g. a 503).

- _Blocking_ `<null> rt.time.sleep(<int> time_in_ms)`: Suspends execution for at
least the amount of time requested.

- `<null> rt.time.run_later(<float> delay_in_ms, <fn> fn_to_run, <T> args)`:
Schedules `fn_to_run` for execution in the future.


### Accessor Interface and Properties

- `<T> get(<string> port_name)`: Get the current value of an input to a given
port.

- `<void> set(<string> port_name, <T> val)`: Set the value of an output port.

**TODO:** Should this return the parameter typed instead of strings?
- `<string> get_parameter(<string> parameter_name)`: Get the value of a
configured parameter.

- `<accessor> load_dependency(<string> path, <dict> parameters=null)`: Loads a
  new accessor as a dependency. Dependencies are guaranteed to exist at
  runtime.
   - Dependencies are lazily init-ed, meaning that the dependency's `init`
     method is not called until the first time the dependency is accessed.
   - You may call a dependency's `init` method directly to force immediate
     and predictable initialization.
   - Attempts to call a dependency's `init` method after it has already been
     initialized are (**TODO:** ignored / throw an exception).

### Sockets

All socket related functions are scoped under the `socket` object. The socket
API mirrors the traditional Berkeley sockets API and should look very familiar
to anyone who has used an object-oriented version before (e.g. python's). Note
that __all__ socket operations are blocking.  This is due to the fact that some
runtimes (e.g. a web browser) do not have native socket support and may need to
perform complex operations (e.g. tunnel to a support server).

- _Blocking_ `<socket> rt.socket.socket(<string> family, <string> sock_type)`:
This function creates a new socket object. The `family` must be one of the
standard family names (e.g. `AF_INET` or `AF_INET6`) and the `sock_type` must
be a standard socket name (e.g. `SOCK_DGRAM` or `SOCK_STREAM`).

The remaining functions are all members of the returned socket object.

**TODO:** How should data be passed into the send/recv functions? Perhaps they
should use [blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob)?
- _Blocking_ `void <socket>.sendto (<string> message, [<string> host, <int> port])`:
This method is only valid for `SOCK_DGRAM` sockets. It sends the message to the
specified host.

### HTTP Requests

All HTTP related functions are scoped under the `http` object.

- _Blocking_ `<string> rt.http.request(<string> url, <string> method, <string>
properties=null, <string> body=null, <int> timeout=null)`: Currently a wrapper
around XMLHTTPRequest, needs to be revisited, especially for non-browser
runtimes.

- _Blocking_ `<string> rt.http.readURL(<string> url)`: A convenience function for
`GET`-ing a URL that wraps `http.request`.

- _Blocking_ `<void> rt.http.post(<string> url, <string> body)`: HTTP POST.

- _Blocking_ `<void> rt.http.put(<string> url, <string> body)`: HTTP PUT.

### Color Functions

When writing accessors that use colors (such as lighting) it may be useful
to change colors between various color representations. The `color` object
makes this easier.

- `<hsv object> rt.color.hex_to_hsv(<string> hex_color)`: Convert a hex color
string (like "0000FF") to an HSV object (like
`{h: [hue (0-360)], s: [saturation (0-1)], v: [value (0-1)]}`).

- `<string> rt.color.hsv_to_hex(<hsv object> hsv_color)`: Convert an HSV object
to an RGB hex string.

### Encoding Functions

Various devices may need data in a variety of encodings. These functions help
convert between them.

- `<string> rt.encode.atob(<base64> str)`: Decode a base64 encoded string.

- `<base64> rt.encode.btoa(<string> str)`: Encode a string in the base64 format.
