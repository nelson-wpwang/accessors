Getting the Accessor Environment Setup
======================================

There are a couple pieces in the accessor framework.
Each plays a specific role in getting accessors to work.

Initial Setup
-------------

A decent portion of the accessor code runs in Python3. Make sure you have
python 3.3+ installed then run

    sudo pip3 install -r requirements.txt

to get all the necessary Python3 packages installed. You may need to change
the name of `pip3` based on which platform you are on.


Accessor Host Server
--------------------

The accessor host server is an HTTP server that provides the accessors that can
be run in an accessor runtime. The host server also servers lists of accessors
that are valid in a give location.

The accessor host server is located in the `/server` folder. To run it with
the accessors and locations in this repo:

    cd server
    ./accessor_host.py -p ../accessors -l ../locations

See `./server/README.md` for more information on how to interact with the
accessor host server.


Accessor Runtimes
-----------------

Runtimes are where accessors are run. They provide the necessary support
libraries (http, socket, etc.) to allow accessors to interact with the world.

There are a couple in this repository.

### Accessor Node Runtime

You need node.js (>= 0.11) or io.js.

### Accessor Python Runtime

The python runtime uses [node](http://nodejs.org) to run accessors.

The python runtime allows for more traditional programmatic access to
accessors. An accessor is a python object. All of the accessor ports are
mapped as attributes of the object. Writing an attribute will fire the
port with the new value. Python accessors are lazily loaded, that is they
are not `init()`'ed until first use. You can use the `_init()` method to
initialize the accessor immediately.

`runtimes/python` contains some examples for using accessors in python.

#### Python runtime setup

The python runtime requirements are included in the master requirements
list, that is

`(sudo) pip install -r requirements.txt`

You also must have a copy of [node](https://nodejs.org) >= version 0.11
installed. If needed, [nvm](github.com/creationix/nvm) is a tool that helps
to manage multiple node installations.

Finally, you need the node package harmony-reflect:

`(sudo) npm install (-g) harmony-reflect`

### Accessor Java Runtime

The Java runtime uses [nashorn][nashorn] (built into JDK8+) to run accessors.

Each accessor is instantiated as a `new AccessorRuntime(...)` object that
has methods to get, set, and fire ports in the accessor. There are several
examples in `runtimes/java` that show how to use an accessor in Java.

#### Java runtime setup

Your Java environment must support [ScriptEngine][ScriptEngine] (JDK7+) and
the ScriptEngine must have support for [nashorn][nashorn] (JDK8+).

You need to run `bower install` in the `runtimes/java` directory once first.
The `runtimes/java/test.sh` script will handle this automatically for you.

[ScriptEngine]: https://docs.oracle.com/javase/7/docs/api/javax/script/ScriptEngine.html
[nashorn]: http://openjdk.java.net/projects/nashorn/
