'use strict'
const StandardHandler = require('./standardHandler')
const gc = require('../utils/gitConstants')
const mc = require('../utils/metadataConstants')
const path = require('path')
const fs = require('fs')

const readFileSyncOptions = {
  encoding: gc.UTF8_ENCODING,
}

class CustomObjectHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return
    this._handleMasterDetailException()
  }

  _handleMasterDetailException() {
    if (this.type !== CustomObjectHandler.OBJECT_TYPE) return

    const fieldsFolder = path.resolve(
      this.config.repo,
      path.join(path.parse(this.line).dir, mc.FIELD_DIRECTORY_NAME)
    )
    if (!fs.existsSync(fieldsFolder)) return

    fs.readdirSync(fieldsFolder)
      .filter(fieldPath =>
        fs
          .readFileSync(
            path.resolve(this.config.repo, fieldsFolder, fieldPath),
            readFileSyncOptions
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

  static OBJECT_TYPE = 'objects'
}

module.exports = CustomObjectHandler
