'use strict'
const path = require('path')

const EOLRegex = /\r?\n/g

const treatPathSep = data => data.replace(/[/\\]+/g, path.sep)
const sanitizePath = data =>
  data !== null && data !== undefined
    ? path.normalize(treatPathSep(data))
    : data
async function* linify(stream) {
  let previous = ''
  for await (const chunk of stream) {
    previous += chunk
    let eolIndex = previous.search(EOLRegex)
    while (eolIndex >= 0) {
      yield previous.slice(0, eolIndex)
      previous = previous.slice(eolIndex + 1)
      eolIndex = previous.search(EOLRegex)
    }
  }
  if (previous.length > 0) {
    yield previous
  }
}

module.exports.treatPathSep = treatPathSep
module.exports.sanitizePath = sanitizePath
module.exports.linify = linify
