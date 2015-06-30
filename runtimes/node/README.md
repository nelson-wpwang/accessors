Accessors - Node Runtime
========================

The `accessors.js` file is a node module for interfacing with accessors
inside of the Node.js (io.js) runtime.


Install
-------

    npm install accessors.io


Example
-------

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

API
---

- `<void> set_host_server (<string> host_server)`: Update the accessor host server to use
when retrieving new accessors. Defaults to `http://accessors.io`.

- `<string> get_host_server ()`: Get the current server used to retrieve
accessors.

- `<void> set_output_functions (<object> functions)`: Configure the functions
used for console output. Valid keys are:

        {
          log: Replace console.log
          info: Replace console.info
          error: Replace console.error
          debug: Replace debug output
        }

- `<array> get_accessor_list (<function> cb)`: Retrieve
a list of all accessors from the host server.

- `<void> compile_dev_accessor (<string> path, <function> cb)`:
Load an accessor from a path, send it to the host to be parsed, and call
`cb` with an identifier to get the compiled accessor.

- `<object> get_test_accessor_ir (<string> path, <function> cb)`:
Get the IR for an accessor designed to test some aspect of the system.
Likely not used in production code.

- `<object> get_dev_accessor_ir (<string> path, <function> cb)`:
Get the IR for a local accessor that was compiled.

- `<object> get_accessor_ir (<string> accessor_path, <function> success, <function> failure)`:
Retrieve just the accessor intermediate representation from the host server
for a given accessor. This does not create an accessor, but is useful for things
like determining the required parameters for a given accessor.

- `<object> get_accessor_ir_from_url (<string> url, <function> cb)`:
Retrieve the accessor IR from a fully specified URL.

- `<accessor> create_accessor (<string> accessor_path, <object> parameters, <function> cb)`:
Generate an accessor object for an accessor with the given
path and initialize it with the parameters.

- `<accessor> load_accessor (<object> accessor_ir, <object> parameters, <function> cb)`:
Generate an accessor from an intermediate representation. This can
be used after `get_accessor_ir()` to create an accessor.


Accessor Port API
-----------------

After an accessor has been created, the next step is to put it to use by
interacting with its ports. This can be done by calling functions on the
accessor object. Remember, that JavaScript is asynchronous, so all return values
from the accessor will be handled as callbacks.

The basic format looks like this:

- `accessor`:

  - `.write(<string> port_name, <port-type> value, <function> done)`:
  Send a value to a given input port. The `done` function will be called
  with an error if one occurred.

  - `.read(<string> port_name, <function> cb)`:
  Read from an output port. When a value is ready, `cb` will be called
  with an error argument and the value.

  - `.on(<string> port_name, <function> cb)`:
  Listen to all values output from a port. This follows the Event Emitter
  pattern, and the `cb` is called with `error, value`.


As a more concrete example, consider a lightbulb that has a port named `Power`
that can be turned on and off.

Input example:

```javascript
// Turn the light off
accessor.write('Power', false, function (err) {
    if (err) {
        // An error occured while controlling the light.
    }
	// Light was turned off successfully.
});
```

Output example:

```javascript
// Check the current light state
accessor.read('Power', function (err, state) {
    if (err) {
        // Error occurred reading the light.
    }
	// variable `state` contains true if the light is on, false otherwise
});
```

Listen example:

```javascript
// Get all events when the light bulb changes state
accessor.on('Power', function (err, new_state) {
    if (err) {
        // Error occurred reading the light.
    }
	// This callback will get called with the new light state.
});
```
