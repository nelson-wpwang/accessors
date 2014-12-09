Accessor Hosting Server
=======================

This server compiles and hosts accessors. Accessors are compiled by including
ports from interfaces above them in the hierarchy. Accessors URLs are created
based on the folder hierarchy where they are stored.

For example, a URL might look like:

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.json


### Parameters

Certain accessors may need configuration parameters for different locations
and devices. These parameters are passed in the URL. For example, different
Hue light bulbs may have different IP addresses. To avoid hard-coding
the IP addresses in the accessor, the request can look like:

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.json?ipaddress=123.45.67.1
    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.json?ipaddress=123.45.67.2


### XML

Accessors can also be requested in XML format. To do so simply replace '.json'
with '.xml':

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.xml

### Other Options

The accessor server can do other transformations on accessors before
they are sent to the client. These are, like parameters, specified by URL
parameters. Example:

    http://accessors.com/accessor/onoffdevice/light/hue/SingleHue.json?_language=traceur


| Option Name | Valid Values             | Default | Description |
| ----------- | ------------             | ------- | ----------- |
| _language   | traceur, es6, javascript | es6     | Choose the language of the accessor code. By default the code is in the latest version of javascript. |



Locations
---------

Essential to the accessor architecture is a mechanism to retrieve valid
accessors given a certain location. To accomplish this, the accessor host
server can provide accessor lists based on location.

Location files look like:


    {
    	"accessors": [
    		"/webquery/StockTick"
    	]
    }

Again, their URLs are based on the hierarchy of their location. For example:

    http://accessors.com/accessors/usa/michigan/annarbor/universityofmichigan/bbb/4908/accessors.json

Once an application has the accessor list it can iterate through the list of
accessors and retrieve the ones that it needs using the above URLs.