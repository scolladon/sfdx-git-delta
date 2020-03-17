'use strict'
const fs = require('fs')
const path = require('path')

module.exports = class FileUtils {
  constructor(config) {
    this.config = config
  }

  writeChangesAsync(changes, fileName) {
    if (Boolean(!changes) || Boolean(!fileName)) {
      return Promise.resolve()
    }
    return new Promise((resolve, reject) =>
      fs.writeFile(
        path.join(this.config.output, fileName),
        changes,
        'utf8',
        err =>
          (err && reject(err)) ||
          resolve(path.join(this.config.output, fileName))
      )
    )
  }
}
