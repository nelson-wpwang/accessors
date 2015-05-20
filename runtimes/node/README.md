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

- `<array> get_accessor_list (<function> success, <function> failure)`: Retrieve
a list of all accessors from the host server.

- `<object> get_accessor_ir (<string> accessor_path, <function> success, <function> failure)`:
Retrieve just the accessor intermediate representation from the host server
for a given accessor. This does not create an accessor, but is useful for things
like determining the required parameters for a given accessor.

- `<accessor> create_accessor (<string> accessor_path, <object> parameters, <function> success, <function> failure)`: Generate an accessor object for an accessor with the given
path and initialize it with the parameters.

- `<accessor> load_accessor (<object> accessor_ir, <object> parameters, <function> success, <function> failure)`: Generate an accessor from an intermediate representation. This can
be used after `get_accessor_ir()` to create an accessor.


Accessor Port API
-----------------

After an accessor has been created, the next step is to put it to use by
interacting with its ports. This can be done by calling functions on the
accessor object. Remember, that JavaScript is asynchronous, so all return values
from the accessor will be handled as callbacks.

The basic format looks like this:

```javascript
// To control the device:
accessor.<port function>.input(<value to set port to>, finished_callback, error_callback);

// To read from the device:
accessor.<port function>.output(callback_with_value, error_callback);

// To wait for data from the device:
accessor.<port function>.observe(callback_data_ready, finished_callback, error_callback);
```

As a more concrete example, consider a lightbulb that has a port named `Power`
that can be turned on and off.

Input example:

```javascript
// Turn the light off
accessor.Power.input(false, function () {
	// Light was turned off successfully.
},
function (err) {
	// An error occured while controlling the light.
});
```

Output example:

```javascript
// Check the current light state
accessor.power.output(function (state) {
	// variable `state` contains true if the light is on, false otherwise
},
function (err) {
	// Error occurred reading the light.
});
```

Observe example:

```javascript
// Get all events when the light bulb changes state
accessor.Power.observe(function (new_state) {
	// This callback will get called with the new light state.
},
function () {
	// Could get an error while setting this up.
});
```



Description
-----------

When a new accessor is loaded, a node module is dynamically created. It is
literally the string concatonation of the accessor javascript and the runtime
in which the accessor will run. The accessor is init'd and then returned to
the caller.

* `runtime.js` contains the core implementation of the accessor runtime. It
  loads the `runtime_lib.js` as a module to export.
* `runtime_lib.js` contains the implementations for the accessor `rt` library
  functions.
