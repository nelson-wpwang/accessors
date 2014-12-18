#!/usr/bin/env node
/*jslint indent: 2, node: true, nomen: true, vars: true */
// vim: sts=2 sw=2 ts=2 et:
"use strict";

var _ = require('underscore');
var fs = require('fs');
var esprima;

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
    throw "MemberExpression more complex that I currently handle";
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
  if (node.callee.name === 'get_dependency') {
    if (_.contains(dependency_list, node.arguments[0].value)) {
      throw "Duplicate dependency: " + node.arguments[0].value;
    }
    dependency_list.push(node.arguments[0].value);
  }
}

var parameter_list = [];

function checkGetParameter(node) {
  if (node.callee.name === 'get_parameter') {
    if (!_.contains(parameter_list, node.arguments[0].value)) {
      parameter_list.push(node.arguments[0].value);
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
  var legal_port_types = ["button", "bool", "string", "numeric", "integer", "select", "color"];

  for (idx in pnode) {
    if (pnode.hasOwnProperty(idx)) {
      prop = pnode[idx];

      if (prop.type !== 'Property') {
        throw "Unxpected non-property in port parameters: " + prop;
      }
      if (prop.key.type !== 'Identifier') {
        throw "Property keys must be known identifiers. Got: " + prop.key;
      }
      // prop.key.name is valid here
      if (prop.kind !== 'init') {
        throw "Unknown port property kind: " + prop.kind;
      }
      if (prop.method) {
        throw "Property " + prop.key.name + " cannot be a function";
      }
      if (prop.shorthand) {
        throw "Unknown prop.shorthand == true for " + prop.key.name;
      }
      if (prop.computed) {
        throw "Port properties must be static values (not computed) in " + prop.key.name;
      }

      // Now validate the actual properties:
      if (prop.key.name === 'display_name') {
        if (prop.value.type !== 'Literal') {
          throw port.name + ".display_name property must be a static string";
        }
        if (port.display_name !== undefined) {
          throw port.name + ": duplicate key display_name";
        }
        port.display_name = prop.value.value;
      } else if (prop.key.name === 'description') {
        if (prop.value.type !== 'Literal') {
          throw port.name + ".description property must be a static string";
        }
        if (port.description !== undefined) {
          throw port.name + ": duplicate key description";
        }
        port.description = prop.value.value;
      } else if (prop.key.name === 'type') {
        if (prop.value.type !== 'Literal') {
          throw port.name + ".type property must be a static string";
        }
        if (port.type !== undefined) {
          throw port.name + ": duplicate key type";
        }
        port.type = prop.value.value;

        if (!_.contains(legal_port_types, port.type)) {
          throw port.name + ".type == " + port.type + " not in legal types: " + legal_port_types;
        }
      } else if (prop.key.name === 'units') {
        if (prop.value.type !== 'Literal') {
          throw port.name + ".units property must be a static string";
        }
        if (port.units !== undefined) {
          throw port.name + ": duplicate key units";
        }
        port.units = prop.value.value;
      } else if (prop.key.name === 'default') {
        if (prop.value.type !== 'Literal') {
          throw port.name + ".default property must be static";
        }
        if (port.default !== undefined) {
          throw prot.name + ": duplicate key default";
        }
        port.default = prop.value.value;
      } else if (prop.key.name === 'options') {
        throw "not implemented: options";
      } else if (prop.key.name === 'min') {
        if (port.min !== undefined) {
          throw port.name + ": duplicate key min";
        }
        port.min = prop.value.value;
      } else if (prop.key.name === 'max') {
        if (port.max !== undefined) {
          throw port.name + ": duplicate key max";
        }
        port.max = prop.value.value;
      } else {
        throw "Illegal port property: " + prop.key.name;
      }
    }
  }

  // port default type is string
  if (port.type === undefined) {
    port.type = 'string';
  }

  if ((port.type === 'button') && (port.direction !== 'input')) {
    throw port.name + ": Port with type button must be an input port";
  }
  if ((port.type === 'select') && (!port.options)) {
    throw port.name + ": Port with type select must include options";
  }
  if (port.type === 'select') {
    throw "not implemented: select";
  }

  if (port.min !== undefined) {
    if (typeof port.min !== 'number') {
      throw port.name + ": min must be a number";
    }
    if (port.type === 'integer') {
      if (!isInteger(port.min)) {
        throw port.name + ": Port is type integer, but min key is not an integer";
      }
    } else if (port.type !== 'numeric') {
      throw port.name + ": Port is non-numeric but has a min key";
    }
  }
  if (port.max !== undefined) {
    if (typeof port.max !== 'number') {
      throw port.name + ": max must be a number";
    }
    if (port.type === 'integer') {
      if (!isInteger(port.max)) {
        throw port.name + ": Port is type integer, but max key is not an integer";
      }
    } else if (port.type !== 'numeric') {
      throw port.name + ": Port is non-numeric but has a max key";
    }
  }

  if ((port.min !== undefined) && (port.max !== undefined)) {
    if (!(port.min < port.max)) {
      throw port.name + ": Port min !< max (" + port.min + " !< " + port.max + ")";
    }
  }

  if (port.units !== undefined) {
    checkNewPortUnits(port);
  }
}

var port_list = [];

function checkNewPorts(node) {
  if (node.callee.name === 'create_port') {
    var directionNode = node.arguments[0];
    var nameNode = node.arguments[1];
    var parametersNode = node.arguments[2];

    var legal_directions = ["input", "output", "inout"];
    if (directionNode.type !== 'Literal') {
      throw "First argument to 'create_port' must be a fixed string";
    }
    if (!_.contains(legal_directions, directionNode.value)) {
      throw "First argument to 'create_port' must be one of " + legal_directions;
    }

    var legal_port_regex = /^[A-Za-z]\w*$/;
    if (nameNode.type !== 'Literal') {
      throw "Second argument to 'create_port' must be a fixed string";
    }
    if (!legal_port_regex.test(nameNode.value)) {
      throw "Port name " + nameNode.value + " is not a legal port name";
    }

    if ((parametersNode === undefined) || (parametersNode === null)) {
      return;
    }
    if (parametersNode.type !== 'ObjectExpression') {
      throw "Third argument to 'create_port' must be a dictionary of named parameters";
    }

    var port = {
      direction: directionNode.value,
      name: nameNode.value,
    };

    checkNewPortParameters(
      port,
      parametersNode.properties
    );

    port_list.push(port);
  }
}

function processFunction(node) {
  console.log(node);
}

function on_read(err, data) {
  if (err) { throw err; }

  var syntax;

  syntax = esprima.parse(data);
  //console.log(JSON.stringify(syntax, null, 1));

  traverse(syntax.body, function (node) {
    if (node.type === 'CallExpression') {
      checkForRuntime(node);
      checkGetDependency(node);
      checkGetParameter(node);
      checkNewPorts(node);
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
    runtime_imports: runtime_list,
    dependencies: dependency_list,
    parameters: parameter_list,
    ports: port_list
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

//console.log("\n-----------------------------------------------");
//console.log("Parsing " + process.argv[2]);
fs.readFile(process.argv[2], 'ascii', on_read);
