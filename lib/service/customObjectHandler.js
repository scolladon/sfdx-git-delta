'use strict'
const StandardHandler = require('./standardHandler')
const gc = require('../utils/gitConstants')
const mc = require('../utils/metadataConstants')
const path = require('path')
const fs = require('fs')

const OBJECT_TYPE = 'objects'

class CustomObjectHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta || this.type !== OBJECT_TYPE) return
    const fieldsFolder = path.join(
      path.parse(this.line).dir,
      mc.FIELD_DIRECTORY_NAME
    )
    fs.readdirSync(path.resolve(this.config.repo, fieldsFolder))
      .filter(fieldPath =>
        fs
          .readFileSync(
            path.resolve(this.config.repo, fieldsFolder, fieldPath),
            {
              encoding: gc.UTF8_ENCODING,
            }
          )
          .includes(mc.MASTER_DETAIL_TAG)
      )
      .forEach(field =>
        this._copyFiles(
          path.resolve(this.config.repo, fieldsFolder, field),
          path.resolve(this.config.output, fieldsFolder, field)
        )
      )
  }
}

module.exports = CustomObjectHandler
