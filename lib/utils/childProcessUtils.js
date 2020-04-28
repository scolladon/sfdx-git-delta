'use strict'
const os = require('os')
const path = require('path')
const gc = require('./gitConstants')

module.exports.treatDataFromSpawn = data =>
  Buffer.from(data)
    .toString(gc.UTF8_ENCODING)
    .replace(/[\/\\]+/g, path.sep)
    .replace(/\r?\n/g, os.EOL)
