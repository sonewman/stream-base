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

var inherits = require('inherits')
var EE = require('./events')

module.exports = Writable
Writable.WritableState = WritableState

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk
  this.encoding = encoding
  this.callback = cb
}

function WritableState(options) {
  this.highWaterMark = 16
  this.needDrain = false
  this.ending = false
  this.ended = false
  this.finished = false
  this.length = 0
  this.writing = false
  this.corked = 0
  this.sync = true
  this.bufferProcessing = false
  this.defaultEncoding = options.defaultEncoding || null
  this.writecb = null
  this.writelen = 0
  this.buffer = []
  this.pendingcb = 0
  this.prefinished = false
  this.emittedError = false
}

function Writable(options) {
  if (!(this instanceof Writable))
    return new Writable(options)

  options = options || {}
  this._writableState = new WritableState(options, this)
  this.writable = true
  EE.call(this)
}

inherits(Writable, EE)

Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'))
}

function isFunc(obj) {
  return 'function' === typeof obj
}

function emitError(stream, err, cb) {
  stream.emit('error', err)
  process.nextTick(function () {
    cb(err)
  })
}

function isNullOrUndefined(obj) {
  return obj === undefined || obj === null
}

Writable.prototype._isValidChunk = function (chunk, cb) {
  if (isNullOrUndefined(chunk)) {
    emitError(this, new TypeError('Invalid chunk'), cb)
    return false
  } else {
    return true
  }
}

Writable.prototype._writeAfterEnd = function (cb) {
  emitError(this, new Error('write after end'), cb)
}

function createWritevcb(state, cbs) {
  return function (err) {
    for (var i = 0, l = cbs.length; i < l; i++)
      cbs[i](err)
  }
}

Writable.prototype._clearWritev 
= function (state, buffer) {
  var cbs = []
  var len = buffer.length
  for (var i = 0; i < len; i++)
    cbs.push(buffer[i].callback)

  var writevcb = createWritevcb(state, cbs)
  this._doWrite(true, state.length, buffer, null, writevcb)
  buffer.length = 0
  return i
}

Writable.prototype._clearWrite = function (state, buffer) {
  var len = buffer.length
  var item, chunk, encoding, cb

  for (var i = 0; i < len; i++) {
    item = buffer[i]
    chunk = item.chunk
    encoding = item.encoding
    cb = item.callback

    this._doWrite(false, 1, chunk, encoding, cb)
    if (state.writing) {
      i++
      break
    }
  }

  return i
}

Writable.prototype._clearBuffer = function (state) {
  if (this._writev && state.buffer.length > 1)
    return this._clearWritev(state, state.buffer)
  else 
    return this._clearWrite(state, state.buffer)

}

Writable.prototype._doWrite 
= function (writev, len, chunk, enc, cb) {
  var stream = this
  var state = stream._writableState
  state.writelen = len
  state.writecb = cb
  state.writing = true
  state.sync = true

  function onwrite_(err) {
    onwrite(stream, state, err)
  }

  if (writev) this._writev(chunk, onwrite_)
  else this._write(chunk, enc, onwrite_)

  state.sync = false
}

function onwriteStateUpdate(state) {
  state.writing = false
  state.writecb = null
  state.length -= state.writelen
  state.writelen = 0
}

function onwriteShouldClearBuffer(finished, state) {
  return !finished
    && !state.corked
    && !state.bufferProcessing
    && state.buffer.length
}

function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false
    stream.emit('drain')
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state)
  cb()
  maybeFinish(stream, state)
}

function onwriteError(stream, state, sync, err, cb) {
  function onnextTick() {
    cb(err)
  }

  if (sync) process.nextTick(onnextTick)
  else cb(err)

  stream._writableState.errorEmitted = true
  stream.emit('error', er)
}


function clearBuffer(stream, state) {
  state.bufferProcessing = true
  var count = stream._clearBuffer(state)

  if (count < state.buffer.length)
    state.buffer = state.buffer.slice(count)
  else
    state.buffer.length = 0

  state.bufferProcessing = false
}

function onwrite(stream, state, err) {
  var cb = state.writecb
  var sync = state.sync
  var finished

  onwriteStateUpdate(state)
  function onnextTick() {
    afterWrite(stream, state, finished, cb)
  }

  if (err) {
    onwriteError(state, state, sync, err, cb)
  } else {
    finished = needFinish(state, state)
    if (onwriteShouldClearBuffer(finished, state))
      clearBuffer(stream, state)

    if (sync) afterWrite(stream, state, finished, cb)
    else process.nextTick(onnextTick)
  }
}

function writeOrBuffer(stream, state, chunk, encoding, cb) {
  state.length++

  var ret = state.length < state.highWaterMark
  if (!ret) state.needDrain = true

  if (state.writing || state.corked)
    state.buffer.push(new WriteReq(chunk, encoding, cb))
  else
    stream._doWrite(false, 1, chunk, encoding, cb)

  return ret
}

function write_(stream, state, chunk, encoding, cb) {
    function then(err) {
      state.pendingcb--
      cb(err)
    }

    state.pendingcb++
    return writeOrBuffer(stream, state, chunk, encoding, then)
}

function write(stream, state, chunk, encoding, cb) {
  var ret = false

  if (state.ended)
    stream._writeAfterEnd(cb)
  else if (stream._isValidChunk(chunk, cb))
    ret = write_(stream, state, chunk, encoding, cb)

  return ret
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState

  if (isFunc(encoding)) {
    cb = encoding
    encoding = null
  }

  if (!encoding)
    encoding = state.defaultEncoding

  if (!isFunc(cb))
    cb = function () {}
  
  return write(this, state, chunk, encoding, cb)
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'))
}

Writable.prototype._writev = null

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState
  if (isFunc(chunk)) {
    cb = chunk
    chunk = null
    encoding = null
  } else if (isFunc(encoding)) {
    cb = encoding
    encoding = null
  }

  if (!isNullOrUndefined(chunk))
    this.write(chunk, encoding)

  if (state.corked) {
    state.corked = 1
    this.uncork()
  }

  if (!state.ending && !state.finished)
    this._endWritable(cb)
}

Writable.prototype.cork = function () {
  this._writableState.corked++
}

function uncorkShouldClearBuffer(state) {
  return !state.writing &&
    !state.corked &&
    !state.finished &&
    !state.bufferProcessing &&
    state.buffer.length > 0
}

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked === 0) return
  
  state.corked--
  if (uncorkShouldClearBuffer(state))
    clearBuffer(this, state)
}

function needFinish(state) {
  return !!state.ending
    && state.length === 0
    && !state.finished
    && !state.writing
}

Writable.prototype._prefinish = function () {
  var state = this._writableState

  if (!state.prefinished) {
    state.prefinished = true
    this.emit('prefinish')
  }
}

function maybeFinish(stream, state) {
  var need = needFinish(state)
  if (need) {
    if (state.pendingcb === 0) {
      stream._prefinish()
      state.finished = true
      stream.emit('finish')
    } else {
      stream._prefinish()
    }
  }
}

Writable.prototype._endWritable = function (cb) {
  var state = this._writableState
  state.ending = true
  maybeFinish(this, state)
  if (cb) {
    if (state.finished) process.nextTick(cb)
    else this.once('finish', cb)
  }
}
