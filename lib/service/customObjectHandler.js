'use strict'
const StandardHandler = require('./standardHandler')
const SubCustomObjectHandler = require('./subCustomObjectHandler')
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')

class CustomObjectHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
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
              encoding: 'utf8',
            }
          )
          .includes(SubCustomObjectHandler.MASTER_DETAIL_TAG)
      )
      .forEach(field =>
        this.promises.push(
          fse.copy(
            path.resolve(this.config.repo, fieldsFolder, field),
            path.resolve(this.config.output, fieldsFolder, field)
          )
        )
      )
  }
}

CustomObjectHandler.OBJECT_META_XML_SUFFIX = `object${StandardHandler.METAFILE_SUFFIX}`
CustomObjectHandler.FIELD_DIRECTORY_NAME = 'fields'
module.exports = CustomObjectHandler
