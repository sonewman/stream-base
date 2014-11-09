var inherits = require('inherits')
var Transform = require('./transform')

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options)
  
  Transform.call(this, options)
}

inherits(PassThrough, Transform)

module.exports = PassThrough

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk)
}

