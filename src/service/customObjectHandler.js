'use strict'
const StandardHandler = require('./standardHandler')
const gc = require('../utils/gitConstants')
const mc = require('../utils/metadataConstants')
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')

const readFileOptions = {
  encoding: gc.UTF8_ENCODING,
}

const asyncFilter = async (arr, predicate) =>
  arr.reduce(
    async (memo, e) => ((await predicate(e)) ? [...(await memo), e] : memo),
    []
  )

class CustomObjectHandler extends StandardHandler {
  async handleAddition() {
    super.handleAddition()
    if (!this.config.generateDelta) return
    await this._handleMasterDetailException()
  }

  async _handleMasterDetailException() {
    if (this.type !== CustomObjectHandler.OBJECT_TYPE) return

    const fieldsFolder = path.resolve(
      this.config.repo,
      path.join(path.parse(this.line).dir, mc.FIELD_DIRECTORY_NAME)
    )
    const exists = await fse.pathExists(fieldsFolder)
    if (!exists) return

    const fields = await fs.promises.readdir(fieldsFolder)
    const masterDetailsFields = await asyncFilter(fields, async fieldPath => {
      const content = await fs.promises.readFile(
        path.resolve(this.config.repo, fieldsFolder, fieldPath),
        readFileOptions
      )
      return content.includes(mc.MASTER_DETAIL_TAG)
    })

    await Promise.all(
      masterDetailsFields.map(field =>
        this._copyFiles(
          path.resolve(this.config.repo, fieldsFolder, field),
          path.resolve(this.config.output, fieldsFolder, field)
        )
      )
    )
  }

  static OBJECT_TYPE = 'objects'
}

module.exports = CustomObjectHandler
