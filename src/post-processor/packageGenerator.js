'use strict'

const BaseProcessor = require('./baseProcessor')
const PackageConstructor = require('../utils/packageConstructor')

const { outputFile } = require('fs-extra')
const { join } = require('path')

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

class PackageGenerator extends BaseProcessor {
  constructor(work, config, metadata) {
    super(work, config, metadata)
  }

  async process() {
    this.cleanPackages()
    const pc = new PackageConstructor(this.config, this.metadata)
    await Promise.all(
      [
        {
          filename: `${DESTRUCTIVE_CHANGES_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          xmlContent: pc.constructPackage(
            this.work.diffs[DESTRUCTIVE_CHANGES_FILE_NAME]
          ),
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: PACKAGE_FILE_NAME,
          xmlContent: pc.constructPackage(this.work.diffs[PACKAGE_FILE_NAME]),
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          xmlContent: pc.constructPackage(new Map()),
        },
      ].map(async op =>
        outputFile(
          join(this.config.output, op.folder, op.filename),
          op.xmlContent
        )
      )
    )
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
      }
    }
  }
}
module.exports = PackageGenerator
