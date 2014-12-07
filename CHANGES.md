Accessor Updates from Michigan
==============================

After deciding to take our own spin with accessors we made some changes along
the way. None of these changes is necessarily permanent but were inspired
by our own workflow and vision for what accessors can be.


Changes
-------

1. **XML -> JSON**. Our accessors are written in the JSON format rather than
XML. JSON is simpler to write than XML while being just as useful for accessors.
It is also easier to parse into Javascript and Python as it very well matches
the datatypes in those languages. Not that even though accessors are specified
in JSON, they can be transparently converted to XML.

2. **Renamed and Updated Runtime Functions**. We use the term "runtime" to refer to an
environment in which accessors are executed in. The runtime functions are
then the Javascript functions that accessor code can execute. To better allow
for expansion and clarity of code we have renamed and namespaced many of these
functions. Also, because Javascript is event based, writing Javascript code
often entails a significant amount of callbacks and nesting. To mitigate this,
and to make accessors easier to write, we are taking advantage of ECMAscript
6 features that make writing asynchronous code look like synchronous code
(similar to await in C#).

        # Examples of function renaming:
        send(<value>, <port name>) -> set(<port name>, <value>)
        readURL(<url>) -> http.readURL(<url>)

        # Examples of asynchronous code
        html = yield* http.readURL('http://google.com');

        vs.

        http.readURL('http://google.com', function (html) {
        	...
        });


2. **Expanded Accessor Interface**. We keep `init()`, `fire()`, and `wrapup()`
as the main interface for the accessor runtime to call an accessor. However,
a single `fire()` function may not be desirable in all cases. To allow for
more interactive and responsive accessors, accessors may define a function
for each port it includes. For example, a TV accessor may have power, input,
volume, and channel ports. Rather than require that on every volume change
a single `fire()` function updates all state or checks to see what changed,
the accessor writer can define a `Volume(<volume level>)` function that
just sets the volume. The accessor runtime can just call the `Volume()` function
and fallback to the `fire()` function if `Volume()` doesn't exist.


3. **Hierarchy for Accessors**. Our implementation enforces a hierarchy for
all accessors. The reasons for this are two-fold:

    1. Allows for grouping common accessors, which can then be understood by
    a computer. For example, all accessors in the hierarchy `/onoffdevice/light`
    can be understood to be some sort of lighting device. If an app using
    accessors wants to control the lights on behalf of a user it retrieves all
    valid accessors in the `/onoffdevice/light` portion of the hierarchy and
    then doesn't need to know about the specific characteristics of the light,
    just that it is a light.

    2. Allows for inheriting ports from the hierarchy to avoid redundancy. In
    the `/onoffdevice/light` example, because every `light` inherits from
    `onoffdevice`, every light will have a `Power` port that turns the
    device on or off. This removes the burden of adding the `Power` port in
    every light accessor. It also allows any runtime that wants to use
    any generic `light` type to know that it can control the `Power` port.


4. **Accessor Host Server**. To serve accessors to devices that use them
we use an accessor host server. The accessor host server begins by parsing all
known accessors and then makes them available via GET requests based on
the hierarchy mentioned above. For instance, to get the accessor for a Hue
light looks like: `http://accessors.io/accessor/onoffdevice/light/hue/huesingle.json`.


5. **Accessor Parameters**. Accessors are intended to be generic interfaces and
code for accessing a certain device. For example, the Hue accessor should be
able to control any Hue bulb. However, The Hue accessor needs to know the URL
of the Hue bridge a specific bulb is attached to in order to control it. Rather
than make the user specify this, this can be specified when the accessor is
downloaded from the accessor host server. This accessor then becomes a method
to control a particular bulb, which is often more useful than being able
to control any bulb. Parameters are passed as HTTP arguments on the GET request
URL. In the Hue example:
`http://accessors.io/accessor/onoffdevice/light/hue/huesingle.json?bridge_url=http://myhue.com`


6. **Accessor Dependencies**. Low-level accessors may be useful for interacting
with specific devices but may not provide the interfaces that people actually
want to use. Consider the example of trying to play a movie and having to use
the audio receiver accessor to enable sound and the TV accessor to enable the
display and the lights accessor to dim the lighting. Instead, a user most likely
wants to use the movie accessor. To enable this without duplicating the code
for the audio, TV, and light accessors, we allow the movie accessor to specify
those accessors as dependencies. The movie accessor can then invoke the
sub-accessor code rather than recreating it. The code would look something like
this:

        # In the "movie" accessor that has a port named "Movie"
        function Movie () {
          Audio.Power(true);
          Audio.Volume(20);
          TV.Power(true);
          TV.Input('Movie');
          Light.Power(false);
        }






