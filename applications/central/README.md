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

The run script should get things started. For instance, to run the stock
example:

    ./run.sh stocks

You can also override the parameters with a parameters file. `parameters.json`:

    {
    	"<block uuid>": {
    		"<parameter name>": "<parameter value>"
    	}
    }


Designing Blocks Apps by Hand
-----------------------------

To do this you specify, in JSON, a list of blocks and connections.

```json
{
	"blocks": [
		{
			"type": "<block type>",
			"parameters": {
				"<parameter name>": "<parameter value>"
			},
			"uuid": "<block uuid>"
		},
		...
	],
	"connections": [
		{
			"src": "<block uuid>.<port name>",
			"dst": "<block uuid>.<port name>"
		},
		...
	]
}
```

