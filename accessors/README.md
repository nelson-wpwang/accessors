Accessors
=========

Creating an accessor consists of writing a JavaScript file and organizing
the accessor in the hierarchy. The best starting point is to copy an accessor
that is similar to the new device and edit it as needed.


Accessor JavaScript Format
--------------------------

At the top is a commented header block:

```js
// author:  <your name>
// email:   <your email>
// website: <your website>

/*
 * <accessor description>
 *
 */
```

Next you define an init function and specify interfaces, ports, and dependencies.

```js
function init () {
	// Specify interfaces and ports.
	// See ../runtimes/README.md for API information
}
```

Then you define port functions for each port.

```js
Power.input = function* () {
	// Control the power state of the device.
}
```

The `function*` is explained in `/runtimes/README.md`.
