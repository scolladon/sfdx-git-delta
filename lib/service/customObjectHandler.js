'use strict'
const StandardHandler = require('./standardHandler')
const SubCustomObjectHandler = require('./subCustomObjectHandler')
const gc = require('../utils/gitConstants')
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')

class CustomObjectHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return
    const fieldsFolder = path.join(
      path.parse(this.line).dir,
      CustomObjectHandler.FIELD_DIRECTORY_NAME
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
          .includes(SubCustomObjectHandler.MASTER_DETAIL_TAG)
      )
      .forEach(field =>
        this._copyFiles(
          path.resolve(this.config.repo, fieldsFolder, field),
          path.resolve(this.config.output, fieldsFolder, field)
        )
      )
  }
}

CustomObjectHandler.OBJECT_META_XML_SUFFIX = `object${StandardHandler.METAFILE_SUFFIX}`
CustomObjectHandler.FIELD_DIRECTORY_NAME = 'fields'
module.exports = CustomObjectHandler
