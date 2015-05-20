Central Application
===================

Goal: build applications by connecting lines between blocks and accessors.

Tip
---

Get parameters.js from `shed/projects/wearabouts`.


Install
-----

    npm install


Node.js
-------

Need new Node (or just use [io.js](https://iojs.org/en/index.html)!)

    nvm use 0.11

Run

    node --harmony test.js

You don't need `--harmony` with io.js.


npm link
--------

Sometimes it is useful to run with an editable version of the accessor
runtime. To do this:

    cd accessors/runtimes/node
    npm link
    cd ../../applications/central
    npm link accessors


Running A Blocks App
--------------------

The run script should get things started. For instance, to run

