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
var Readable = require('./readable')
var Writable = require('./writable')

inherits(Duplex, Readable)

;(function (dp, wp) {
  for (var method in wp) {
    if (!dp[method]) dp[method] = wp[method]
  }
}(Duplex.prototype, Writable.prototype)) 

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options)

  Readable.call(this, options)
  Writable.call(this, options)

  if (options && options.readable === false)
    this.readable = false

  if (options && options.writable === false)
    this.writable = false

  this.allowHalfOpen = true
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false

  this.once('end', onend)
}

module.exports = Duplex

function onend() {
  var self = this
  if (!allowHalfOpen && !self._writableState.ended) {
    process.nextTick(function () {
      self.end() 
    })
  }
}
