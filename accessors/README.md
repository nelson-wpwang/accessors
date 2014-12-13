Accessor Format
===============


Accessors are written by accessor authors as `JSON` files. The following specifies
how to write an accessor. Note that the following is how to write a raw accessor.
Full, completed accessors retreived from an accessor host server will vary
slightly from the following syntax.

The basic format is:

```json
{
	"[KEY]": VALUE
}
```

Accessor Fields
---------------

Here is the list of valid keys, some of which are required.
Any other keys will be ignored.

| KEY            | Required | Type          | Description |
| ---            | -------- | ------        | ----------- |
| `name`         | yes      | string        | The name of the accessor. |
| `version`      | yes      | string        | The version number of the accessor. |
| `author`       | yes      | object        | Information about the author. Must be an object with the keys: `name`, `email`, `website`. |
| `description`  | no       | string        | Description of the accessor written in Markdown syntax. |
| `ports`        | no       | array         | Input and output fields for this accessor. See the "Ports" section below. |
| `parameters`   | no       | array         | Values which must be specified for a particular instantiation of this accessor. These are set when the accessor is retrieved from the accessor host server. |
| `code`         | no       | object        | Code that makes the accessor run. See the "Code" section for more details. |
| `dependencies` | no       | array         | Other accessors that must be loaded in order for this accessor to run. See the "Accessor Dependencies" section for more details. |


### Ports

Ports specify how data goes into and out of accessors. Ports are specified
as a list of objects where each object is a port. Here are the keys that
are valid in the port object:

| KEY            | Required | Type          | Description |
| ---            | -------- | ------        | ----------- |
| `direction`    | yes      | string        | Specifies if this port takes data from the user, displays data to the user, or both. Valid choices are: `input`, `output`, and `inout`. |
| `name`         | yes      | string        | Port name. Valid characters are "A-Z", "a-z", "0-9", and "_". |
| `type`         | no       | string        | Specifies the data type of the port. Defaults to "string". See "Port Types" below for more information. |
| `default`      | no       | `<type>`      | Specify a default value for the port |
| `options`      | no       | array         | Only valid when `type` == "select". Specifies the list of valid options the user can select from. |
| `min`          | no       | number        | Only valid when `type` == "integer" or "numeric". Allows the accessor runtime to limit input values. |
| `max`          | no       | number        | Only valid when `type` == "integer" or "numeric". Allows the accessor runtime to limit input values. |


#### Port Types

Port types essentially specify the data type of the port. Valid choices are:

| Port Type | Description |
| --------- | ----------- |
| `button`  | Only valid when `type` == "input". Display a button the user can press. |
| `bool`    | Any true/false field. Likely will show as a checkbox. |
| `string`  | Any string entry. Likely will just be a text field the user can write in. |
| `numeric` | Any number. Can be constrained by using "min" and/or "max" keys. Using "min" and "max" allows the UI to be cleaner as the runtime can display a slider or other easier to use UI element.  |
| `integer` | Constrain the numeric field to just integers. See `numeric` section for information about "min" and "max". |
| `select`  | Shows the user a list of options to choose from. Use the `options` key to specify the options. |
| `color`   | Allow the user to enter a color. Will likely display a color picker. Color will be represented by a six digit RGB hex string. Example: "00FF00". |
| `currency_usd` | Display a number formatted as US currency |

#### Ports Example

```json
"ports": [
	{
		"direction": "output",
		"name":      "Name"
	},
	{
		"direction": "inout",
		"name":      "Input",
		"type":      "select",
		"options":   ["PC", "Apple TV", "Internet"]
	},
	{
		"direction": "inout",
		"name":      "Front LED Color",
		"type":      "color"
	},
	{
		"direction": "inout",
		"name":      "Volume",
		"type":      "integer",
		"min":       0,
		"max":       100
	}
]
```




### Parameters

Parameters allow for otherwise generic accessors to be customized to a particular
device or room. Parameters are specified as a list of objects. Here are the valid
keys in an accessor parameter object:

| KEY            | Required | Type          | Description |
| ---            | -------- | ------        | ----------- |
| `name`         | yes      | string        | Name of the parameter. |
| `default`      | no       | string        | Value of the parameter if it is not otherwise specified when the accessor is requested. Has no effect if `required` is set to `true`. |
| `required`     | no       | bool          | Defaults to `true`. Specifies whether the parameter must be set when the accessor is requested. If the parameter is not specified in the request an error will be returned. |

#### Parameters Example

```json
"parameters": [
	{
		"name": "username",
		"required": true
	},
	{
		"name": "device_url",
		"required": true
	},
	{
		"name": "favorite",
		"default": "device_0"
	}
]
```

### Code

The magic of accessors is their included code. The `code` key specifies the available
code and what language(s) the code is in. Code is specified as an object. The keys
of the object are programming language names. Each language name key has another
object as its value. The valid keys in the second object are:

| KEY            | Required | Type          | Description |
| ---            | -------- | ------        | ----------- |
| `code`         | no       | string        | A string of code. Will be included last in the generated accessor by the accessor host server. |
| `include`      | no       | array         | A list of files that should be included when the final code blob is created by the accessor host server. The files will be appended in order. Using `include` makes writing the accessor code easier than including it in this file. |

#### Code Example

```json
"code": {
	"javascript": {
		"include": ["some_common_code.js", "myaccessor.js"]
	},
	"python": {
		"code": "import myaccessor
def fire():
	myaccessor.do_the_python()"

	}
}
```

### Dependencies

Often it may be useful to compose accessors, that is, create a higher-level interface
from a set of lower-level accessors. Think of this like an "all-in-one remote":
playing a movie may require the TV accessor, the audio accessor, and the Blu-ray
accessor. By specifying dependencies an accessor is able to use the sub-accessor's
code rather than having to recreate it.

Dependencies are specified as a list of objects. Here are the valid keys in the
objects:

| KEY            | Required | Type          | Description |
| ---            | -------- | ------        | ----------- |
| `name`         | yes      | string        | Name to map the sub-accessor to. This name will be used when creating the object for the sub-accessor. |
| `path`         | yes      | string        | Path to the sub-accessor. Can point to an accessor on the local accessor host server or a remote one. Parameters can also be passed if needed. |
| `parameters`   | no       | object        | Object of <parameter_name:parameter_value> pairs. Use this to set the parameters of the sub-accessor to a constant value. |

#### Dependencies Example

```json
"dependencies": [
	{
		"name": "MyHue",
		"path": "/onoffdevice/light/hue/huesingle.json"
	},
	{
		"name": "MyRoomLight",
		"path": "/onoffdevice/light/roomlight.json?room_number=7104"
	},
	{
		"name": "MyCustomLight",
		"path": "http://myaccessorserver.com/accessor/onoffdevice/light/custom.json"
	}
]
```



Accessor Example
----------------

```json
{
	"name":    "Denon AVR-1913",
	"version": "0.1",
	"author":  "Brad Campbell",
	"description": "
Denon AVR-1913 Accessor
=======================

The Denon AVR-1913 is a digital receiver.
",

	"ports": [
		{
			"direction": "output",
			"name":      "Name"
		},
		{
			"direction": "inout",
			"name":      "Input",
			"type":      "select",
			"options":   ["PC", "Apple TV", "Internet"]
		},
		{
			"direction": "inout",
			"name":      "Audio Mode",
			"type":      "select",
			"options":   ["Multi Channel Stereo, Stereo"]
		}
	],

	"parameters": [
		{
			"name": "device_url",
			"default": "http://localhost"
		}
	],

	"code": {
		"javascript": {
			"include": ["denonavr1913.js"]
		}
	}
}
```


