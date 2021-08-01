'use strict'
const os = require('os')
const path = require('path')

const treatEOL = data => data.replace(/\r?\n/g, os.EOL)
const treatPathSep = data => data.replace(/[/\\]+/g, path.sep)
const sanitizePath = data =>
  data !== null && data !== undefined
    ? path.normalize(treatPathSep(data))
    : data

module.exports.treatDataFromSpawn = data => treatEOL(treatPathSep(data))
module.exports.treatEOL = treatEOL
module.exports.sanitizePath = sanitizePath
