'use strict'
const os = require('os')
const path = require('path')

module.exports.treatDataFromSpawn = data =>
  data.replace(/[/\\]+/g, path.sep).replace(/\r?\n/g, os.EOL)
