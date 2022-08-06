'use strict'

const BaseProcessor = require('./baseProcessor')
const PackageBuilder = require('../utils/packageHelper')

const { outputFile } = require('fs-extra')
const { join } = require('path')

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

class PackageGenerator extends BaseProcessor {
  async process() {
    this.cleanPackages()
    await this.buildPackages()
  }

  cleanPackages() {
    const additive = this.work.diffs[PACKAGE_FILE_NAME]
    const destructive = this.work.diffs[DESTRUCTIVE_CHANGES_FILE_NAME]
    for (const [type, members] of additive) {
      if (destructive.has(type)) {
        destructive.set(
          type,
          new Set(
            [...destructive.get(type)].filter(element => !members.has(element))
          )
        )
        if (destructive.get(type).size === 0) {
          destructive.delete(type)
        }
      }
    }
  }

  async buildPackages() {
    const pc = new PackageBuilder(this.config, this.metadata)
    await Promise.all(
      [
        {
          filename: `${DESTRUCTIVE_CHANGES_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          xmlContent: this.work.diffs[DESTRUCTIVE_CHANGES_FILE_NAME],
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: PACKAGE_FILE_NAME,
          xmlContent: this.work.diffs[PACKAGE_FILE_NAME],
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          xmlContent: new Map(),
        },
      ].map(async op =>
        outputFile(
          join(this.config.output, op.folder, op.filename),
          pc.buildPackage(op.xmlContent)
        )
      )
    )
  }
}
module.exports = PackageGenerator
