Node Runtime
============

The `accessors.js` file is a node module for interfacing with accessors
inside of the Node.js (io.js) runtime. 


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



API
---



