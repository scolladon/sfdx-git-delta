'use strict'
const StandardHandler = require('./standardHandler')
const SubCustomObjectHandler = require('./subCustomObjectHandler')
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')

class CustomObjectHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()

    const objectPath = path.parse(path.join(this.config.repo, this.line))

    fs.readdirSync(path.join(objectPath.dir, 'fields'))
      .filter(fieldPath =>
        fs
          .readFileSync(fieldPath)
          .includes(SubCustomObjectHandler.MASTER_DETAIL_TAG)
      )
      .forEach(field =>
        this.promises.push(
          fse.copy(
            path.normalize(field),
            path.normalize(field.replace(this.config.repo, this.config.output))
          )
        )
      )
  }
}

CustomObjectHandler.OBJECT_META_XML_SUFFIX = `object${StandardHandler.METAFILE_SUFFIX}`
module.exports = CustomObjectHandler
