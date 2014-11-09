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

module.exports = Readable
Readable.ReadableState = ReadableState

function ReadableState(options, stream) {
  this.highWaterMark = 16

  this.buffer = []
  this.length = 0
  this.pipes = null
  this.pipesCount = 0
  this.flowing = null
  this.ended = false
  this.emittedEnd = false
  this.emittedReadable = false
  this.needReadable = false
  this.readableListening = false
  this.reading = false
  this.awaitDrain = 0
  this.sync = true
}


function Readable(options) {
  if (!(this instanceof Readable))
    return new Readable(options)
  
  this.readable = true
  this._readableState = new ReadableState(options, this)
  EE.call(this)
}

inherits(Readable, EE)


Readable.prototype._onend = function () {
  this._emitReadable()
}

function nullOrUndefined(chunk) {
  return chunk === undefined || chunk === null
}

function canReadMore(state) {
  return !state.reading
    && !state.flowing
    && !state.ended
    && state.length < state.highWaterMark
}

function maybeReadMore_(stream, state) {
  var len = state.length
  while(canReadMore(state)) {
    stream.read(0)
    if (len === state.length) break;
    else len = state.length
  }
  state.readingMore = false
}

function maybeReadMore(stream, state) {
  state.readingMore = true
  process.nextTick(function () {
    maybeReadMore_(stream, state)
  })
}

Readable.prototype._needMoreData = function () {
  var state = this._readableState

  return !state.ended
    && (state.needReadable
      || state.length < state.highWaterMark
      || state.length === 0)
}

Readable.prototype._flowData = function (chunk, prepend) {
  this.emit('data', chunk)
  this.read(0)
}

Readable.prototype._bufferData = function (chunk, prepend) {
  var state = this._readableState
  state.length += 1
  if (prepend) state.buffer.unshift(chunk)
  else state.buffer.push(chunk)

  if (state.needReadable)
    this._emitReadable()
}

function shouldFlowData(state) {
  return state.flowing && state.length !== 0 && !state.sync
}

function addChunk(stream, state, chunk, prepend) {
  var end = nullOrUndefined(chunk)
  var err

  if (end) {
    state.ended = true
    stream._onend()
  } else if (state.ended && !prepend) {
    err = new Error('stream.push() after end')
    stream.emit('error', err)
  } else if (state.endEmitted && prepend) {
    err = new Error('stream.unshift() after end event');
    stream.emit('error', e);
  } else {

    if (!prepend)
      state.reading = false;

    shouldFlowData(state)
      ? stream._flowData(chunk, prepend)
      : stream._bufferData(chunk, prepend)

    maybeReadMore(stream, state)
  }

  return stream._needMoreData()
}

Readable.prototype.push = function (chunk) {
  return addChunk(this, this._readableState, chunk)
}

Readable.prototype.unshift = function (chunk) {
  return addChunk(this, this._readableState, chunk, true)
}

Readable.prototype._read = function (n) {
  this.emit('error', new Error('not implemented'))
}

Readable.prototype._howMuchToRead = function (n) {
  return n === 0 ? 0 : 1
}

Readable.prototype._sliceBuffered = function (n) {
  var ret = this._readableState.buffer.shift()
  return nullOrUndefined(ret) ? null : ret
}

function read0(n, state) {
  return n === 0 && state.needReadable &&
    (state.length >= state.highWaterMark || state.ended)
}

Readable.prototype.read = function (n) {
  var state = this._readableState
  var orig = n

  if ('number' !== typeof n || n > 0)
    state.emittedReadable = false

  if (read0(n, state)) {
    if (state.length === 0 && state.ended)
      this._endReadable()
    else
      this._emitReadable()

    return null
  }

  n = this._howMuchToRead(n)

  if (n === 0 && state.ended) {
    if (state.length === 0)
      this._endReadable()

    return null
  }

  var doRead = this._shouldRead(n)

  if (doRead) {
    state.reading = true
    state.sync = true

    if (state.length === 0)
      state.needReadable = true

    this._read(state.highWaterMark)
    state.sync = false

    if (!state.reading)
      n = this._howMuchToRead(orig)
  }

  var ret = null
  if (n > 0) ret = this._sliceBuffered(n)

  if (ret === null) {
    state.needReadable = true
    n = 0
  }

  state.length -= n
  
  if (state.length === 0 && !state.ended)
    state.needReadable = true

  if (orig !== n && state.ended && state.length === 0)
    this._endReadable()

  if (ret !== null)
    this.emit('data', ret)

  return ret
}

Readable.prototype._shouldRead = function (n) {
  var state = this._readableState
  var length = state.length

  if (state.ended || state.reading)
    return false
  else if (length === 0)
    return true
  else
    return state.needReadable
}

function flow(stream, state) {
  var chunk
  if (!state.flowing) return
  do {
    chunk = stream.read()
  } while (chunk !== null && state.flowing)
}

function emitReadable_(stream) {
  stream.emit('readable')
  flow(stream, stream._readableState)
}

function emitReadable(stream, state) {
  state.needReadable = false
  if (state.emittedReadable) return
  state.emittedReadable = true
  if (state.sync)
    process.nextTick(function () {
      emitReadable_(stream)
    })
  else
    emitReadable_(stream)
}

Readable.prototype._emitReadable = function () {
  emitReadable(this, this._readableState)
}

function endReadable(stream, state) {
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream')

  if (state.emittedEnd) return

  state.ended = true
  process.nextTick(function () {
    if (!state.emittedEnd && state.length === 0) {
      state.emittedEnd = true
      stream.readable = false
      stream.emit('end')
    }
  })
}

Readable.prototype._endReadable = function () {
  endReadable(this, this._readableState)
}

var on = Readable.prototype.on
Readable.prototype.on = function (env, fn) {
  var self = this
  var res = on.call(self, env, fn)
  var state = self._readableState

  if (env === 'data' && state.flowing !== false)
    self.resume()

  if (env === 'readable' && self.readable) {
    if (!state.readableListening) {

      state.readableListening = true
      state.emittedReadable = false
      state.needReadable = true

      if (state.reading) {
        if (state.length) {
          self._emitReadable()
          return res
        }
      } else {
        process.nextTick(function () {
          self.read(0)
        })
      }
    }
  }
  return res
}
Readable.prototype.addListener = Readable.prototype.on

function resume_(stream, state) {
  state.resumeScheduled = false
  stream.emit('resume')
  flow(stream, stream._readableState)
  if (state.flowing && !state.reading)
    stream.read(0)
}

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true
    process.nextTick(function () {
      resume_(stream, state)
    })
  }
}

Readable.prototype.resume = function () {
  var state = this._readableState
  if (!state.flowing) {
    state.flowing = true
    if (!state.reading) this.read(0)
    resume(this, state)
  }
  return this
}


function addPiped(state, dest) {
  switch (state.pipesCount) {
    case 0: state.pipes = dest; break;
    case 1: state.pipes = [state.pipes, dest]; break;
    default: state.pipes.push(dest); break;
  }
  state.pipesCount += 1;
}

Readable.prototype.pipe = function (dest, options) {
  var src = this
  var state = src._readableState

  addPiped(state, dest)

  var doEnd = (!options || options.end !== false)
    && dest !== process.stdout
    && dest !== process.stderr

  var end_ = doEnd ? onend : cleanup

  if (state.emittedEnd) process.nextTick(end_)
  else src.once('end', end_)

  dest.on('unpipe', onunpipe)
  function onunpipe(readable) {
    if (readable === src) cleanup()
  }

  function onend() {
    dest.end()
  }

  dest.on('drain', ondrain)
  function ondrain() {
    if (state.awaitDrain) state.awaitDrain--

    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
      state.flowing = true
      flow(src, state)
    }
  }

  function cleanup() {
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);
  }

  src.on('data', ondata)
  function ondata(chunk) {
    var next = dest.write(chunk)
    if (next === false) {
      src._readableState.awaitDrain++
      src.pause()
    }
  }

  function onerror(er) {
    unpipe();
    dest.removeListener('error', onerror)
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er)
  }

  if (!dest._events || !dest._events.error)
    dest.on('error', onerror)
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror)
  else
    dest._events.error = [onerror, dest._events.error]

  function unpipe() {
    src.unpipe(dest)
  }

  function onclose() {
    dest.removeListener('finish', onfinish)
    unpipe()
  }
  dest.once('close', onclose)

  function onfinish() {
    dest.removeListener('close', onclose)
    unpipe()
  }
  dest.once('finish', onfinish)

  dest.emit('pipe', src)

  if (!state.flowing) src.resume()

  return dest
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this

    if (!dest)
      dest = state.pipes

    // got a match.
    state.pipes = null
    state.pipesCount = 0
    state.flowing = false
    if (dest)
      dest.emit('unpipe', this)
    return this
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes
    var len = state.pipesCount
    state.pipes = null
    state.pipesCount = 0
    state.flowing = false

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this)
    return this
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest)
  if (i === -1)
    return this

  state.pipes.splice(i, 1)
  state.pipesCount -= 1
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0]

  dest.emit('unpipe', this)

  return this
}
