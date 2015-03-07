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

Need new Node

    nvm use 0.11

Run 

    node --harmony test.js

