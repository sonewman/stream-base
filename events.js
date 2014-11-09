// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.
//
// AMENDMENTS MADE BY SAM OLIVER NEWMAN 2014

function isFunc(fn) {
  return 'function' === typeof fn
}

function isObj(obj) {
  return 'object' === typeof obj
}

module.exports = EventEmitter

function EventEmitter() {
  if (!this._events)
    this._events = {}

  this._maxListeners = this._maxListeners
    || undefined
}

EventEmitter.prototype._events = null

EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (!util.isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number')

  this._maxListeners = n
  return this
}

function addEvent(ee, events, type, fn) {
  var max
  var event = events[type]

  if (!event) {
    events[type] = fn
  } else if (isFunc(events[type])) {
    events[type] = [event, fn]
  } else {
    event.push(fn)
  }
  
  if (isObj(event) && !event.warned) {
    max = ee._maxListeners
      ? ee._maxListeners
      : EventEmitter.defaultMaxListeners

    if (max > 0 && event.length > max) {
      event.warned = true;
      console.error('(node) warning: possible EventEmitter memory '
        + 'leak detected. %d %s listeners added. '
        + 'Use emitter.setMaxListeners() to increase limit.'
        , event.length, type);

      console.trace();
    }
  }
}

EventEmitter.prototype.addListener = addListener
EventEmitter.prototype.on = addListener
function addListener(type, listener) {
  if (!isFunc(listener))
    throw new TypeError('Listener must be a function')

  if (!this._events) this._events = {}
  addEvent(this, this._events, type, listener)

  return this
}

EventEmitter.prototype.once = once
function once(type, listener) {
  if (!isFunc(listener))
    throw new TypeError('Listener must be a function')

  var fired = false

  function handle() {
    if (fired) return

    fire = true
    callFn(listener, arguments, this, 0)
  }

  handle.listener = listener
  this.on(type, handle)
  return this
}

function callFn(fn, args, ctx, off) {
  var argArr, i
  var l = args.length

  if (i < 2) {
    fn.call(ctx);
  } else if (i === 2) {
    fn.call(ctx, args[off + 0]);
  } else if (i === 3) {
    fn.call(ctx, args[off + 0], args[off + 1]);
  } else if (i === 4) {
    fn.call(ctx, args[off + 0], args[off + 1], args[off + 2]);
  } else {
    argArr = new Array(l - off)
    for (i = off; i < l; i++) argArr[i - off] = args[i]
    fn.apply(ctx, argArr)
  }
}

EventEmitter.prototype.emit = emit
function emit(type) {
  var handler
  var i, l, err

  if (!this._events) this._events = {}
  
  // If there is no 'error' event listener then throw.
  if (type === 'error' && !this._events.error) {
    err = arguments[1];
    if (err instanceof Error) {
      throw err; // Unhandled 'error' event
    } else {
      throw Error('Uncaught, unspecified "error" event.');
    }
    return false;
  }

  handler = this._events[type]
  if (handler === undefined) return false

  if (isFunc(handler)) {
    callFn(handler, arguments, this, 1)
  } else {
    l = handler.length
    for (i = 0; i < l; i++)
      callFn(handler[i], arguments, this, 1)
  }

  return true
}

function match(a, b) {
  return a === b || a.listener && a.listener === b
}

EventEmitter.prototype.removeListener = removeListener
function removeListener(type, listener) {
  var list
  var i, index

  if (!isFunc(listener))
    throw new TypeError('Listener must be a function')

  if (!this._events || !this._events[type])
    return this

  list = this._events[type]

  if (match(list, listener)) {
    delete this._events[type]

    if (this._events.removeListener)
      this.emit('removeListener', type, listener)
  } else {
    i = list.length

    if (i === 1) {
      if (match(list[0], listener)) {
        list.length = 0
        delete this._events[type]
      }
    } else {
      while (--i > -1) {
        if (match(list[i], listener)) {
          index = i
          break
        }
      }

      if (index > -1) list.splice(index, 1)
    }
  }

  return this
}

EventEmitter.prototype.removeAllListeners = removeAllListeners
function removeAllListeners(type) {
  var listeners
  var i

  if (!this._events)
    return this

  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {}
    else if (this._events[type])
      delete this._events[type]

    return this
  }

  if (arguments.length === 0) {
    for (i in this._events) {
      if (i === 'removeListener') continue
      this.removeAllListeners(type)
    }

    this.removeAllListeners('removeListener')
    this._events = {}
    return this
  }

  listeners = this._events[type]

  if (isFunc(listeners)) {
    this.removeListener(type, listener)
  } else if (isObj(listeners)) {
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1])
  }

  delete this._events[type]
  return this
}

EventEmitter.prototype.listeners = function listeners(type) {
  if (!this._events || !this._events[type])
    return []
  else if (isFunc(this._events[type]))
    return [this._events[type]]
  else
    return this._events[type].slice()
}

EventEmitter.listenerCount = function(emitter, type) {
  if (!emitter._events || !emitter._events[type])
    return 0
  else if (isFunc(emitter._events[type]))
    return 1
  else
    return emitter._events[type].length
}
