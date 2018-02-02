const core = require("./core");
const coreCmds = require("./cmds");
const coreHandlers = require("./handlers");

let handlers = Object.assign({}, coreHandlers);
let context = {};

function promisify(fn) {
  const validator = fn.validator;
  const promised = function(...args) {
    if (validator) {
      try {
        validator(...args);
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return core.call(context, handlers, fn, ...args);
  };
  // promised.name = fn.name;
  promised.fn = fn;

  promised.callWithContext = function(c, ...args) {
    if (validator) {
      try {
        validator(...args);
      } catch (e) {
        return Promise.reject(e);
      }
    }
    return core.call(Object.assign({}, context, c), handlers, fn, ...args);
  };

  return promised;
}

function setContext(c) {
  context = c;
}

function getContext() {
  return context;
}

function addToContext(c) {
  context = Object.assign({}, context, c);
}

function setHandlers(h) {
  handlers = h;
}

function getHandlers() {
  return handlers;
}

function addToHandlers(h) {
  handlers = Object.assign({}, handlers, h);
}

function reset() {
  handlers = {};
  context = {};
}

module.exports = {
  call: coreCmds.call,
  echo: coreCmds.echo,
  promisify,
  setContext,
  getContext,
  addToContext,
  setHandlers,
  getHandlers,
  addToHandlers,
  reset
};
