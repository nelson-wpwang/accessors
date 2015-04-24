Central Application
===================

Goal: build applications by connecting lines between blocks and accessors.

Tip
---

Get config.js from `shed/projects/wearabouts`.


Setup
-----

First add the local accessors module to the packages by linking them.

    cd accessors/runtimes/node
    npm link
    cd ../../applications/central
    npm link accessors

Other npm installs

    npm install

Need new Node (or just use [io.js](https://iojs.org/en/index.html)!)

    nvm use 0.11

Run 

    node --harmony test.js

You don't need `--harmony` with io.js.

