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

accessors.create_accessor('/webquery/StockTick', {}, function (accessor) {
	// Set the stock symbol we want to query
	accessor.StockSymbol.input('MSFT', function () {
		accessor.Price.output(function (price) {
			console.log('MSFT stock price: $' + price);
		});
	});
},
function (error) {
	console.log('Error loading accessor.')l
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
