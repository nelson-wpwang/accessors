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


Runtime Functions
-----------------

The accessor runtime provides a small library of functions for accessors.
There are primarily I/O functions and serve to abstract the runtime
environment from the accessor.

### General Utility

- `<string> version(<string> set_to=null)`: The version function returns the
version of the accessor runtime environment running when the call to version
returns.  The optional argument `set_to` will request a change to the accessor
version environment. The version request may include range specifiers (e.g.
`>=2.0.0`). If the requested version change cannot be satisfied, the version
is unchanged and the original version is returned.  The accesor runtime is
versioned using [semantic versioning](http://semver.org/).

- `<void> log.[debug,info,warn,error,critical](<string> line)`: The log family
of functions provides a means for logging messages. These messages are
generally intended for developers and should not be used to convey runtime
information.

### Accessor Interface and Properties

- `<T> get(<string> port_name)`: Get the current value of an input to a given
port.

- `<void> set(<string> port_name, <T> val)`: Set the value of an output port.

**TODO:** Should this return the parameter typed instead of strings?
- `<string> get_parameter(<string> parameter_name)`: Get the value of a
configured parameter.

### Sockets

All socket related functions are scoped under the `socket` object. The socket
API mirrors the traditional Berkeley sockets API and should look very familiar
to anyone who has used an object-oriented version before (e.g. python's).

- _Blocking_ `<socket> socket.socket(<string> family, <string> sock_type)`:
This function creates a new socket object. The `family` must be one of the
standard family names (e.g. `AF_INET` or `AF_INET6`) and the `sock_type` must
be a standard socket name (e.g. `SOCK_DGRAM` or `SOCK_STREAM`).
**Note** that this function is _blocking_ and must be called with `yield*`. This
is due to the fact that some runtimes (e.g. a web browser) do not have native
socket support and may need to perform complex operations (e.g. open a tunnel
to a support server).

The remaining functions are all members of the returned socket object.

**TODO:** How should data be passed into the send/recv functions? Perhaps they
should use [blobs](https://developer.mozilla.org/en-US/docs/Web/API/Blob)?
- `void <socket>.sendto (<string> message, [<string> host, <int> port])`: This
method is only valid for `SOCK_DGRAM` sockets. It sends the message to the
specified host.

### HTTP Requests

All HTTP related functions are scoped under the `http` object.

- _Blocking_ `<string> http.request(<string> url, <string> method, <string>
properties=null, <string> body=null, <int> timeout=null)`: Currently a wrapper
around XMLHTTPRequest, needs to be revisited, especially for non-browser
runtimes.

- _Blocking_ `<string> http.readURL(<string> url)`: A convenience function for
`GET`-ing a URL that wraps `http.request`.