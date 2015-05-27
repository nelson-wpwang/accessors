#!/usr/bin/env node
/*jslint indent: 2, node: true, nomen: true, vars: true */
// vim: sts=2 sw=2 ts=2 et:
"use strict";

var _ = require('underscore');
var fs = require('fs');
var esprima;

var warnings = [];
var errors = [];

try {
  esprima = require('esprima');
} catch (e) {
  console.log("Missing required `esprima`.\n");
  console.log("install via:");
  console.log("\tnpm install git://github.com/ariya/esprima#harmony");
  process.exit(1);
}

// http://stackoverflow.com/q/3885817
function isFloat(n) {
  return n === +n && n !== (n|0);
}

function isInteger(n) {
  return n === +n && n === (n|0);
}

function print_tree_from_node(node) {
  console.log(JSON.stringify(node, null, 4));
}

function traverse(object, fn) {
  var key, child;

  fn.call(null, object);
  for (key in object) {
    if (object.hasOwnProperty(key)) {
      child = object[key];
      if (typeof child === 'object' && child !== null) {
        traverse(child, fn);
      }
    }
  }
}

function getRootMemberExpression(mnode) {
  if (mnode.computed !== false) {
    // This is a object['str']() construct
    return null;
  }
  if (mnode.object.type === 'MemberExpression') {
    return getRootMemberExpression(mnode.object);
  }
  if (mnode.object.type !== 'Identifier') {
    //throw "MemberExpression more complex that I currently handle";
    console.error("WARN: Complex MemberExpression ignored");
    return null;
  }
  return mnode;
}

var runtime_list = [];

function checkForRuntime(node) {
  // node is type 'CallExpression' with 'callee' and 'arguments'
  //print_tree_from_node(node);

  // Note: This function only handles static MemberExpressions, that is, it
  //       will miss calls like `global['rt'].version();`. Then again, you
  //       can't do that in an accessor anyway since the name of the global
  //       object changes depending on the runtime anyway

  var root;

  //print_tree_from_node(node);

  root = getRootMemberExpression(node.callee);
  if (!root) {
    return;
  }

  if (root.object.name === 'rt') {
    if (root.property.type !== 'Identifier') {
      throw "Root MemberExpression with non-Identifier property";
    }
    if (!_.contains(runtime_list, root.property.name)) {
      runtime_list.push(root.property.name);
    }
  }
}

var dependency_list = [];

function checkGetDependency(node) {
  var dep = null;

  if (node.callee.name === 'load_dependency') {
    dep = _.find(dependency_list, function (cand) {
      return cand.path === node.arguments[0].value;
    });
    if (dep === undefined) {
      dep = {
        path: node.arguments[0].value
      };
      dependency_list.push(dep);
    }

    if (node.arguments[1] !== undefined) {
      if (node.arguments[1].type === 'Identifier') {
        console.error("WARN: Variables as parameter arguments are unchecked");
      } else if (node.arguments[1].type === 'ObjectExpression') {
        console.error("WARN: Dependency parameters are unchecked");
      } else {
        console.warn("WARN: load_dependency parameters argument must be a dict");
      }
    }
  }
}

var interface_list = [];

function checkProvideInterface(node) {
  var iface = null;

  if (node.callee.name === 'provide_interface') {
    if (node.arguments[0].type !== 'Literal') {
      errors.push({
        loc: node.loc,
        title: "provide_interface() first argument must be a string literal",
      });
      return;
    }

    iface = _.find(interface_list, function (cand) {
      return cand.interface === node.arguments[0].value;
    });
    if (iface !== undefined) {
      errors.push({
        loc: node.loc,
        title: "Multiple provides of same interface: " + node.arguments[0].value,
      });
      return;
    }

    iface = {
      interface: node.arguments[0].value,
      provides: []
    };

    if (node.arguments[1] !== undefined) {
      warnings.push({
        loc: node.loc,
        title: "The provide_interface function takes only 1 argument, the rest are ignored",
      });
    }

    interface_list.push(iface);
  }
}

var parameter_list = [];

function checkGetParameter(node) {
  var parameter = null;

  if (node.callee.name === 'get_parameter') {
    parameter = _.find(parameter_list, function (cand) {
      return cand.name === node.arguments[0].value;
    });
    if (parameter === undefined) {
      parameter = {
        name: node.arguments[0].value,
        required: false,
      };
      parameter_list.push(parameter);
    }

    if (node.arguments[1] === undefined) {
      // No default parameter supplied
      parameter.required = true;
    } else {
      if (node.arguments[1].type !== 'Literal') {
        errors.push({
          loc: node.loc,
          title: "Default parameter value must be a constant for parameter: " + parameter.name,
        });
        return;
      }
      if (parameter.default === undefined) {
        parameter.default = node.arguments[1].value;
      } else {
        if (parameter.default !== node.arguments[1].value) {
          errors.push({
            loc: node.loc,
            title: "Inconsistent defaults for parameter: " + parameter.name,
            extra: ["Attempt to set default to "+node.arguments[1].value+", but it was previously set to "+parameter.default],
          });
        }
      }
    }

    if (node.arguments[2] !== undefined) {
      warnings.push({
        loc: node.loc,
        title: "The get_parameter function takes up to 2 arguments, the rest are ignored",
      });
    }
  }
}

/*jslint unparam: true */
function checkNewPortUnits(port) {
  if (port.units !== 'currency.usd') {
    console.error("WARN: No checks are performed on units currently");
  }
}
/*jslint unparam: false */

function checkNewPortParameters(port, pnode) {
  var prop, idx;
  var options, option, opt_idx;
  var legal_port_types = ["button", "bool", "string", "numeric", "integer", "select", "color", "object"];

  for (idx in pnode) {
    if (pnode.hasOwnProperty(idx)) {
      prop = pnode[idx];

      if (prop.type !== 'Property') {
        errors.push({
          loc: pnode.loc,
          title: "Unxpected non-property in port parameters: " + prop,
        });
        continue;
      }
      if (prop.key.type !== 'Identifier') {
        errors.push({
          loc: pnode.loc,
          title: "Property keys must be known identifiers. Got: '"+prop.key+"' which is of type "+prop.key.type,
        });
        continue;
      }
      // prop.key.name is valid here
      if (prop.kind !== 'init') {
        // Leave as throw b/c I want to see an example
        throw "Unknown port property kind: " + prop.kind;
      }
      if (prop.method) {
        errors.push({
          loc: pnode.loc,
          title: "Property '" + prop.key.name + "' cannot be a function",
        });
        continue;
      }
      if (prop.shorthand) {
        // Leave as throw b/c I want to see an example
        throw "Unknown prop.shorthand == true for " + prop.key.name;
      }
      if (prop.computed) {
        errors.push({
          loc: pnode.loc,
          title: "Port properties must be static values (not computed) in " + prop.key.name,
        });
        continue;
      }

      // Now validate the actual properties:
      if (prop.key.name === 'display_name') {
        if (prop.value.type !== 'Literal') {
          errors.push({
            loc: prop.loc,
            title: port.name + " display_name must be a static string",
          });
          continue;
        }
        if (port.display_name !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key display_name. This is the second definiton.",
          });
          continue;
        }
        port.display_name = prop.value.value;
      } else if (prop.key.name === 'description') {
        if (prop.value.type !== 'Literal') {
          errors.push({
            loc: prop.loc,
            title: port.name + " description must be a static string",
          });
          continue;
        }
        if (port.description !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key description. This is the second definiton.",
          });
          continue;
        }
        port.description = prop.value.value;
      } else if (prop.key.name === 'type') {
        if (prop.value.type !== 'Literal') {
          errors.push({
            loc: prop.loc,
            title: port.name + " type must be a static string",
          });
          continue;
        }
        if (port.type !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key type. This is the second definiton.",
          });
          continue;
        }
        port.type = prop.value.value;

        if (!_.contains(legal_port_types, port.type)) {
          errors.push({
            loc: prop.loc,
            title: "Port '"+port.name+"' has illegal port type '"+port.type+"'",
            extra: ["The legal port types are "+legal_port_types],
          });
          continue;
        }
      } else if (prop.key.name === 'units') {
        if (prop.value.type !== 'Literal') {
          errors.push({
            loc: prop.loc,
            title: port.name + " units must be a static string",
          });
          continue;
        }
        if (port.units !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key units. This is the second definiton.",
          });
          continue;
        }
        port.units = prop.value.value;
      } else if (prop.key.name === 'default') {
        warnings.push({
          loc: prop.loc,
          title: port.name + " default option is deprecated and is ignored",
        });
      } else if (prop.key.name === 'options') {
        if (port.options !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key options. This is the second definiton.",
          });
          continue;
        }
        port.options = [];
        options = prop.value;
        if (options.type !== 'ArrayExpression') {
          errors.push({
            loc: options.loc,
            title: port.name + ": options value must be an array",
            extra: ["It is currently of type " + options.type],
          });
          continue;
        }
        for (opt_idx in options.elements) {
          if (options.elements.hasOwnProperty(opt_idx)) {
            option = options.elements[opt_idx];
            if (option.type !== 'Literal') {
              errors.push({
                loc: option.loc,
                title: port.name + ".options: Elements must be static",
              });
            }
            port.options.push(option.value);
          }
        }
      } else if (prop.key.name === 'min') {
        if (port.min !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key min. This is the second definiton.",
          });
          continue;
        }
        port.min = prop.value.value;
      } else if (prop.key.name === 'max') {
        if (port.max !== undefined) {
          errors.push({
            loc: prop.loc,
            title: port.name + ": duplicate key max. This is the second definiton.",
          });
          continue;
        }
        port.max = prop.value.value;
      } else {
        warning.push({
          loc: prop.loc,
          title: "Unknown port option: "+prop.key.name+". It is ignored.",
        });
      }
    }
  }

  // port default type is string
  if (port.type === undefined) {
    port.type = 'string';
  }

  // TODO: put this check back after we know what port directions are implemented
  // if ((port.type === 'button') && (port.direction !== 'input')) {
  //   throw port.name + ": Port with type button must be an input port";
  // }
  if ((port.type === 'select') && (!port.options)) {
    errors.push({
      loc: pnode.loc,
      title: port.name + ": Port with type select must include options",
    });
  }

  if (port.min !== undefined) {
    if (typeof port.min !== 'number') {
      errors.push({
        loc: pnode.loc,
        title: port.name + ": min must be a number",
      });
      return;
    }
    if (port.type === 'integer') {
      if (!isInteger(port.min)) {
        errors.push({
          loc: pnode.loc,
          title: port.name + ": Port is type integer, but min key is not an integer",
        });
      }
    } else if (port.type !== 'numeric') {
      errors.push({
        loc: pnode.loc,
        title: port.name + ": Port is non-numeric but has a min key",
      });
    }
  }
  if (port.max !== undefined) {
    if (typeof port.max !== 'number') {
      errors.push({
        loc: pnode.loc,
        title: port.name + ": max must be a number",
      });
      return;
    }
    if (port.type === 'integer') {
      if (!isInteger(port.max)) {
        errors.push({
          loc: pnode.loc,
          title: port.name + ": Port is type integer, but max key is not an integer",
        });
      }
    } else if (port.type !== 'numeric') {
      errors.push({
        loc: pnode.loc,
        title: port.name + ": Port is non-numeric but has a max key",
      });
    }
  }

  if ((port.min !== undefined) && (port.max !== undefined)) {
    if (!(port.min < port.max)) {
      errors.push({
        loc: pnode.loc,
        title: port.name + ": Port min !< max (" + port.min + " !< " + port.max + ")",
      });
    }
  }

  if (port.units !== undefined) {
    checkNewPortUnits(port);
  }
}

var created_port_list = [];
var interface_port_list = [];

function checkNewPorts(node) {
  if (node.callee.name === 'create_port') {
    var nameNode = node.arguments[0];
    var parametersNode = node.arguments[1];

    var legal_port_regex = /^[A-Za-z]\w*$/;
    if (nameNode.type !== 'Literal') {
      errors.push({
        loc: node.loc,
        title: "First argument to 'create_port' must be a fixed string",
        extra: ["The current argument is of type "+nameNode.type],
      });
    }
    if (!legal_port_regex.test(nameNode.value)) {
      errors.push({
        loc: nameNode.loc,
        title: "Port name " + nameNode.value + " is not a legal port name",
        extra: ["Legal ports must match "+legal_port_regex],
      });
    }

    var port = {
      name: nameNode.value,
      function: nameNode.value,
      directions: []
    };

    if (parametersNode !== undefined) {
      if (parametersNode.type !== 'ObjectExpression') {
        errors.push({
          loc: parametersNode.loc,
          title: "Second argument to 'create_port' must be a dictionary of named parameters",
          extra: ["The current argument is of type "+parametersNode.type],
        });
      }
      checkNewPortParameters(port, parametersNode.properties);
    } else {
      // We're responsible for setting type to the default
      port.type = 'string';
    }

    if (node.arguments[2] !== undefined) {
      var warning = {
        title: "The create_port function takes only 2 arguments, the rest are ignored",
        loc: node.loc,
      };
      warnings.push(warning);
    }

    created_port_list.push(port);
  }
}

// Looking for <PortName>.<direction> = function* () {
function checkPortFunction(node) {
  if (node.operator == '=') {
    if (node.left.type == 'MemberExpression' && node.right.type == 'FunctionExpression') {
      var direction = node.left.property.name;
      var name_obj = node.left.object;
      var portName = ''
      while (name_obj.type == 'MemberExpression') {
        if (portName.length) {
          portName = name_obj.property.name + '.' + portName;
        } else {
          portName = name_obj.property.name;
        }
        name_obj = name_obj.object;
      }
      if (portName.length) {
        portName = name_obj.name + '.' + portName;
      } else {
        portName = name_obj.name;
      }


      var created = false;

      // Check if this is a port we know about
      for (var i=0; i<created_port_list.length; i++) {
        if (created_port_list[i].name == portName) {

          // Check that the direction is valid
          if (['input', 'output', 'observe'].indexOf(direction) == -1) {
            throw '"' + direction + '" is an invalid direction for port "' + portName + '"';
          }

          created_port_list[i].directions.push(direction);
          created = true;
        }
      };

      if (!created) {
        // Only interested in things that match <string>.<direction>
        if (['input', 'output', 'observe'].indexOf(direction) == -1) {
          return;
        }

        // Don't have a list a priori of interfaces, so learn as we go
        var known_iface = false;
        for (var i=0; i<interface_port_list.length; i++) {
          if (interface_port_list[i].name == portName) {
            interface_port_list[i].directions.push(direction);
            known_iface = true;
          }
        };

        if (!known_iface) {
          var port = {
            name: portName,
            directions: []
          };
          port.directions.push(direction);

          interface_port_list.push(port);
        }
      }
    }
  }
}

function on_read(err, data) {
  if (err) { throw err; }

  var syntax;

  // Clear ports
  //port_list = [];

  syntax = esprima.parse(data, {loc: true});
  //console.log(JSON.stringify(syntax, null, 1));

  traverse(syntax.body, function (node) {
    if (node.type === 'CallExpression') {
      checkForRuntime(node);
      checkGetDependency(node);
      checkProvideInterface(node);
      checkGetParameter(node);
      checkNewPorts(node);

    } else if (node.type == 'AssignmentExpression') {
      // Looking for <PortName>.<direction> = function* ()
      checkPortFunction(node);
    }
  });

  /*
  for (node in syntax.body) {
    if (syntax.body.hasOwnProperty(node)) {
      console.log(syntax.body[node]);
      if (node.type === 'FunctionDeclaration') {
        processFunction(node);
      }
    }
  }
  */

  data = {
    warnings: warnings,
    errors: errors,
    runtime_imports: runtime_list,
    implements: interface_list,
    dependencies: dependency_list,
    parameters: parameter_list,
    created_ports: created_port_list,
    interface_ports: interface_port_list
  };

  console.log(JSON.stringify(data));

  /*
  console.log("Parsing Done.");
  var dep;

  console.log("Runtime Imports:");
  for (dep in runtime_list) {
    if (runtime_list.hasOwnProperty(dep)) {
      console.log("\t" + runtime_list[dep]);
    }
  }

  console.log("Dependencies:");
  for (dep in dependency_list) {
    if (dependency_list.hasOwnProperty(dep)) {
      console.log("\t" + dependency_list[dep]);
    }
  }

  console.log("Parameters:");
  for (dep in parameter_list) {
    if (parameter_list.hasOwnProperty(dep)) {
      console.log("\t" + parameter_list[dep]);
    }
  }
  */
}

//fs.readFile('webquery/StockTick.js', 'ascii', on_read);
//fs.readFile('lockunlockdevice/door/rpidoor.js', 'ascii', on_read);
//fs.readFile('onoffdevice/light/hue/threehues.js', 'ascii', on_read);
// fs.readFile('webquery/GatdOld.js', 'ascii', on_read);
// fs.readFile('lighting/hue/huesingle.js', 'ascii', on_read);
// fs.readFile('switch/acme++.js', 'ascii', on_read);

//console.log("\n-----------------------------------------------");
//console.log("Parsing " + process.argv[2]);
fs.readFile(process.argv[2], 'ascii', on_read);
