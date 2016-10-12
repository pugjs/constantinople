'use strict'

var walk = require('babylon-walk');
var getExpression = require('is-expression-babylon').getExpression;
var t = require('babel-types');

var lastSRC = '(null)';
var lastRes = true;
var lastConstants = undefined;

var STATEMENT_WHITE_LIST = {
  'EmptyStatement': true,
  'ExpressionStatement': true,
};
// See require('babel-types').EXPRESSION_TYPES
var EXPRESSION_WHITE_LIST = {
  ArrayExpression: true,
  // AssignmentExpression: false,
  BinaryExpression: true,
  CallExpression: true,
  ConditionalExpression: true,
  // FunctionExpression: false,
  Identifier: true,
  StringLiteral: true,
  NumericLiteral: true,
  NullLiteral: true,
  BooleanLiteral: true,
  RegExpLiteral: true,
  LogicalExpression: true,
  MemberExpression: true,
  NewExpression: true,
  ObjectExpression: true,
  SequenceExpression: true,
  // ThisExpression: false,
  UnaryExpression: true,
  // UpdateExpression: false,
  // ArrowFunctionExpression: false,
  // ClassExpression: false,
  // MetaProperty: false,
  // Super: false,
  TaggedTemplateExpression: true,
  TemplateLiteral: true,
  // YieldExpression: false,
  TypeCastExpression: true,
  JSXElement: true,
  JSXEmptyExpression: true,
  JSXIdentifier: true,
  JSXMemberExpression: true,
  ParenthesizedExpression: true,
  // AwaitExpression: false,
  BindExpression: true,
  // DoExpression: false,
};
var visitors = {
  Statement: function (node, state) {
    if (!state.stop && !STATEMENT_WHITE_LIST[node.type]) {
      state.stop = true;
    }
  },
  Expression: function (node, state) {
    if (!state.stop && !EXPRESSION_WHITE_LIST[node.type]) {
      state.stop = true;
    }
  },
  'MemberExpression|JSXMemberExpression': function (node, state) {
    if (state.stop) return;
    if (node.computed) return state.stop = true;
    else if (node.property.name[0] === '_') return state.stop = true;
  },
  'Identifier|JSXIdentifier': function (node, state, parents) {
    if (state.stop) return;
    var lastParent = parents[parents.length - 2];
    if (lastParent && !isReferenced(node, lastParent)) return;
    if (!(state.constants && node.name in state.constants)) {
      state.stop = true;
    }
  },
};
module.exports = isConstant;
function isConstant(src, constants, options) {
  if (lastSRC === src && lastConstants === constants) return lastRes;
  lastSRC = src;
  lastConstants = constants;
  var ast;
  try {
    ast = getExpression(src, options);
  } catch (ex) {
    return lastRes = false;
  }
  var state = {
    constants: constants,
    stop: false
  };
  walk.ancestor(ast, visitors, state);

  return lastRes = !state.stop;
}
isConstant.isConstant = isConstant;

isConstant.toConstant = toConstant;
function toConstant(src, constants, options) {
  if (!isConstant(src, constants, options)) throw new Error(JSON.stringify(src) + ' is not constant.');
  return Function(Object.keys(constants || {}).join(','), 'return (' + src + ')').apply(null, Object.keys(constants || {}).map(function (key) {
    return constants[key];
  }));
}

function isReferenced(node, parent) {
  switch (parent.type) {
    // yes: { [NODE]: '' }
    // yes: { NODE }
    // no: { NODE: '' }
    case 'ObjectProperty':
      return parent.value === node || parent.computed;

    // no: break NODE;
    // no: continue NODE;
    case 'BreakStatement':
    case 'ContinueStatement':
      return false;

    // yes: left = NODE;
    // yes: NODE = right;
    case 'AssignmentExpression':
      return true;
  }

  return t.isReferenced(node, parent);
}
