'use strict'

import BaseProcessor from './baseProcessor'
import PackageBuilder from '../utils/packageHelper'

import { outputFile } from 'fs-extra'
import { join } from 'path'

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

export default class PackageGenerator extends BaseProcessor {
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
            [...destructive.get(type)!].filter(element => !members.has(element))
          )
        )
        if (destructive.get(type)!.size === 0) {
          destructive.delete(type)
        }
      }
    }
  }

  async buildPackages() {
    const pc = new PackageBuilder(this.config)
    await Promise.all(
      [
        {
          filename: `${DESTRUCTIVE_CHANGES_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          manifest: this.work.diffs[DESTRUCTIVE_CHANGES_FILE_NAME],
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: PACKAGE_FILE_NAME,
          manifest: this.work.diffs[PACKAGE_FILE_NAME],
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          manifest: new Map(),
        },
      ].map(async op =>
        outputFile(
          join(this.config.output, op.folder, op.filename),
          pc.buildPackage(op.manifest) as string
        )
      )
    )
  }
}
