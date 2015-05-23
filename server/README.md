Accessor Hosting Server
=======================

This server compiles and hosts accessors.
Any client who wishes to use an accessor can retrieve them from an Accessor
Host Server. The server also provides a UI for exploring accessor content.


Running a Local Host Server
---------------------------

1. Install the dependencies. The server is written in Python3 and uses
node.js to perform some validation on the accessor.

        sudo pip3 install -r requirements.pip
        npm install

2. Run the server

        ./accessor_host.py

    By default, the server will pull the `accessor-files` repo from github
    and serve those accessors.

    To configure the accessor host, see the help:

        ./accessor_host.py --help



Requesting an Accessor
----------------------

An accessor URL looks like:

    http://accessors.io/accessor/lighting/hue/HueSingle.json


#### XML

Accessors can also be requested in XML format. To do so simply replace '.json'
with '.xml':

    http://accessors.io/accessor/lighting/hue/HueSingle.xml

#### Options

The accessor server can do transformations on accessors before
they are sent to the client. These are specified by URL
parameters. Example:

    http://accessors.io/accessor/lighting/hue/HueSingle.json?language=traceur


| Option Name | Valid Values             | Default | Description |
| ----------- | ------------             | ------- | ----------- |
| language    | traceur, es6, javascript | es6     | Choose the language of the accessor code. By default the code is in the latest version of javascript. |

