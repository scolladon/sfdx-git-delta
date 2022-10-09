'use strict'
const StandardHandler = require('./standardHandler')
const asyncFilter = require('../utils/asyncFilter')
const { readFileFromGit } = require('../utils/fsHelper')
const {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
  OBJECT_TYPE,
} = require('../utils/metadataConstants')
const { join, parse } = require('path')
const { readdir } = require('fs').promises
const { pathExists } = require('fs-extra')

class CustomObjectHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._handleMasterDetailException()
  }

  async _handleMasterDetailException() {
    if (this.type !== OBJECT_TYPE) return

    const fieldsFolder = join(
      this.config.repo,
      parse(this.line).dir,
      FIELD_DIRECTORY_NAME
    )
    const exists = await pathExists(fieldsFolder)
    if (!exists) return

    const fields = await readdir(fieldsFolder)
    const masterDetailsFields = await asyncFilter(fields, async fieldPath => {
      const content = await readFileFromGit(
        join(this.config.repo, fieldsFolder, fieldPath),
        this.config
      )
      return content.includes(MASTER_DETAIL_TAG)
    })

    await Promise.all(
      masterDetailsFields.map(field =>
        this._copyWithMetaFile(
          join(this.config.repo, fieldsFolder, field),
          join(this.config.output, fieldsFolder, field)
        )
      )
    )
  }
}

module.exports = CustomObjectHandler
