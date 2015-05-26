Accessors - Python Runtime
==========================

***The Python Runtime is currently in alpha.***

The accessors folder is a python package for interfacing with accessors
from Python code.


Install
-------

__NOTE: The accessors library requires Python3__

    # Eventually:
    # pip3 install accessors.io
    # Currently:
    # Make sure the `accessors` folder is in your PYTHON_PATH
    # Easiest to simply run apps in this directory
    # You will still need to run
    pip3 install -r requirements.pip


Example
-------

```python
#!/usr/bin/env python3

import accessors

# First step is to get a "StockTick" object. This is an object that
# encapsulates the accessor so that we can interact with it
stocktick = accessors.get_accessor('/webquery/StockTick')

for symbol in ['GOOG', 'MSFT', 'YHOO']:
	# The StockTick accessor has two ports: "StockSymbol" and "Price".

	# Accessor ports have associated directions: input, output, and observe.
	# Assignments to a port map to input and reads from a port map to output.
	# (Look bitcoin for an example of observe)

	# To use the StockTick accessor, we first set the StockSymbol:
	stocktick.StockSymbol = symbol

	# The we read the Price of the stock:
	print("Stock {} price {}".format(symbol, stocktick.Price))
```

API
---

### Global Options

_Most users should not ever need to set these options._

The accessors library exposes several mechanisms to set options, in order from highest priority to lowest:

1. The library will scan any program for command line arguments beginning with `--accessors-[option]` and honor them.
2. It will also scan for any environment variables of the form `ACCESSORS_[option]`. (replace `-` with `_`)
3. Library users can write to the dictionary `accessors.conf['CONF']`.
4. Built-in default values.

Option Name        | Default
------------------ | -------------
library-server     | accessors.io

### Functions

- `<list> get_accessor_list ()`: Retrieve a list of all accessors from the host server.

- `<dict> get_accessor_ir (<string> accessor_path)`:
Retrieve just the accessor intermediate representation from the host server
for a given accessor. This does not create an accessor, but is useful for things
like determining the required parameters for a given accessor.

- `<accessor> get_accessor (<string> accessor_path, <dict> parameters)`: Generate an accessor object for an accessor with the given
path and initialize it with the parameters.

- `<accessor> load_accessor (<dict> accessor_ir, <dict> parameters)`: Generate an accessor from an intermediate representation. This can
be used after `get_accessor_ir()` to create an accessor.

- `<None> observer_forever ()`: Convenience function that prevents termination

Accessor Port API
-----------------

After an accessor has been created, the next step is to put it to use by
interacting with its ports. The Python runtime treats accessors as objects,
that is you call an accessor's `input` function simply by writing a port and
call an accessor's `output` function by reading the port. You add `observe`
handlers directly to the accessor object.

The basic format looks like this:

```python
// To control the device:
accessor.<port function> = <value to set port to>

// To read from the device:
value = accessor.<port function>

// To wait for data from the device:
accessor.observe("<port function>", callback_data_ready)
```

For specific examples, browse the apps in this folder.

