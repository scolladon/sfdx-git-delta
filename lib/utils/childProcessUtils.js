'use strict'
const gc = require('./gitConstants')

module.exports.treatDataFromSpawn = data =>
  Buffer.from(data).toString(gc.UTF8_ENCODING)
