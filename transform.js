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
var Duplex = require('./duplex')

function TransformState() {
  this.needTransform = false
  this.transforming = false
  this.writecb = null
  this.writechunk = null
}

function isNullOrUndefined(obj) {
  return obj === null || obj === undefined
}

function isFunc(obj) {
  return 'function' === typeof obj
}

function afterTransform(stream, err, data) {
  var ts = stream._transformts
  ts.transforming = false

  var cb = ts.writecb
  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'))

  ts.writechunk = null
  ts.writecb = null

  if (!isNullOrUndefined(data)) 
    stream.push(data)

  cb(err)
  
  var rs = stream._readableState
  rs.reading= false
  if (rs.needReadable || rs.length < rs.highWaterMark)
    stream._read(rs.highWaterMark)
}

function Transform(options) {
  var stream = this
  if (!(stream instanceof Transform))
    return new Transform(options)

  Duplex.call(stream, options)
  stream._transformState = new TransformState()
  var rs = stream._readableState
  rs.needReadable = true
  rs.sync = false

  function onprefinish() {
    function flushcb (err) {
      finish(stream, err)
    }

    if (isFunc(this._flush))
      this._flush(flushcb)
    else
      finish(stream)
  }

  stream.once('prefinish', onprefinish)
}

inherits(Transform, Duplex)

module.exports = Transform

var push = Duplex.prototype.push
Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false
  push.call(this, chunk, encoding)
}

Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('not implemented')
}

function shouldRead(ts, rs) {
  return ts.needTransform
    || rs.needReadable
    || rs.length < rs.highWaterMark
}

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState
  ts.writecb = cb
  ts.writechunk = chunk
  ts.writeencoding = encoding
  if (ts.transforming) return
  
  var rs = this._readableState
  if (shouldRead(ts, rs))
    this._read(rs.highWaterMark)
}

function shouldTransform(ts) {
  return ts.writechunk !== null
    && ts.writecb
    && !ts.transforming
}

Transform.prototype._read = function (n) {
  var stream = this
  var ts = stream._transformState

  function transformcb(err, data) {
    afterTransform(stream, err, data)
  }

  if (shouldTransform(ts)) {
    ts.transforming = true
    stream._transform(ts.writechunk, ts.writeencoding, transformcb)
  } else {
    ts.needTransform = true
  }
}

function finish(stream, err) {
  if (err) return stream.emit('error', err)
  
  if (stream._writableState.length)
    throw new Error('calling transform done when ws.length != 0')

  if (stream._transformState.transforming)
    throw new Error('calling transform done when still transforming')

  return stream.push(null);
}
