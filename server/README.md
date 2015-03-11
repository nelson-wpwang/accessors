Accessor Hosting Server
=======================

This server compiles and hosts accessors. Accessors are compiled by including
ports from interfaces above them in the hierarchy. Accessors URLs are created
based on the folder hierarchy where they are stored.

For example, a URL might look like:

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.json


### XML

Accessors can also be requested in XML format. To do so simply replace '.json'
with '.xml':

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.xml

### Options

The accessor server can do transformations on accessors before
they are sent to the client. These are specified by URL
parameters. Example:

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.json?language=traceur


| Option Name | Valid Values             | Default | Description |
| ----------- | ------------             | ------- | ----------- |
| language    | traceur, es6, javascript | es6     | Choose the language of the accessor code. By default the code is in the latest version of javascript. |

