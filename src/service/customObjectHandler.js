'use strict'
const StandardHandler = require('./standardHandler')
const asyncFilter = require('../utils/asyncFilter')
const { pathExists, readDir, readPathFromGit } = require('../utils/fsHelper')
const {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} = require('../utils/metadataConstants')
const { join, parse } = require('path')

class CustomObjectHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._handleMasterDetailException()
  }

  async _handleMasterDetailException() {
    if (this.type !== OBJECT_TYPE) return

    const fieldsFolder = join(parse(this.line).dir, FIELD_DIRECTORY_NAME)
    const exists = await pathExists(fieldsFolder, this.config)
    if (!exists) return

    const fields = await readDir(fieldsFolder, this.config)
    const masterDetailsFields = await asyncFilter(fields, async fieldPath => {
      const content = await readPathFromGit(
        join(fieldsFolder, fieldPath),
        this.config
      )
      return content.includes(MASTER_DETAIL_TAG)
    })

    await Promise.all(
      masterDetailsFields.map(field =>
        this._copyWithMetaFile(join(fieldsFolder, field))
      )
    )
  }
}

module.exports = CustomObjectHandler
