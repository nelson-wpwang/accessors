ColorPage Example
=================

This accessor example creates a virtual "LED" that can be turned on and off.

To run this example:

1. First install the python dependency:

        sudo pip3 install aiohttp

2. Run the virtual LED:

        ./virtual_led.py

3. Now in a browser, navigate to [http://localhost:8765](http://localhost:8765).
This should be a full-page site that is set to a particular color.

4. Run the accessor. The page should toggle between black (off) and white (on).

        ./colorpage.js



Advanced
--------

The virtual LED can be set to any color. For example, using curl:

    curl --data "color=1590ff" http://localhost:8765/color

sets the LED to a nice blue.

You can use this to create a more advanced accessor that allows setting the
color of the LED!
