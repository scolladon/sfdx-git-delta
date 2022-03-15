'use strict'
const StandardHandler = require('./standardHandler')
const asyncFilter = require('../utils/asyncFilter')
const { UTF8_ENCODING } = require('../utils/gitConstants')
const {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
} = require('../utils/metadataConstants')
const { join, parse, resolve } = require('path')
const { readdir, readFile } = require('fs').promises
const { pathExists } = require('fs-extra')

const readFileOptions = {
  encoding: UTF8_ENCODING,
}

class CustomObjectHandler extends StandardHandler {
  async handleAddition() {
    await super.handleAddition()
    if (!this.config.generateDelta) return
    await this._handleMasterDetailException()
  }

  async _handleMasterDetailException() {
    if (this.type !== CustomObjectHandler.OBJECT_TYPE) return

    const fieldsFolder = join(
      this.config.repo,
      join(parse(this.line).dir, FIELD_DIRECTORY_NAME)
    )
    const exists = await pathExists(fieldsFolder)
    if (!exists) return

    const fields = await readdir(fieldsFolder)
    const masterDetailsFields = await asyncFilter(fields, async fieldPath => {
      const content = await readFile(
        resolve(this.config.repo, fieldsFolder, fieldPath),
        readFileOptions
      )
      return content.includes(MASTER_DETAIL_TAG)
    })

    await Promise.all(
      masterDetailsFields.map(field =>
        this._copyFiles(
          resolve(this.config.repo, fieldsFolder, field),
          resolve(this.config.output, fieldsFolder, field)
        )
      )
    )
  }

  static OBJECT_TYPE = 'objects'
}

module.exports = CustomObjectHandler
