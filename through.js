var Transform = require('./transform')

function through(transform, flush) {
  var t = new Transform()
  t._transform = transform
  t._flush = flush
  return t
}

module.exports = through
