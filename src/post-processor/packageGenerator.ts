'use strict'

import { join } from 'node:path/posix'

import { outputFile } from 'fs-extra'
import { log } from '../utils/LoggingDecorator.js'
import PackageBuilder from '../utils/packageHelper.js'
import BaseProcessor from './baseProcessor.js'

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

export default class PackageGenerator extends BaseProcessor {
  @log
  public override async process() {
    this._cleanPackages()
    await this._buildPackages()
  }

  protected _cleanPackages() {
    const additive = this.work.diffs[PACKAGE_FILE_NAME]
    const destructive = this.work.diffs[DESTRUCTIVE_CHANGES_FILE_NAME]
    for (const [type, members] of additive) {
      const existing = destructive.get(type)
      if (!existing) continue
      const filtered = new Set<string>()
      for (const element of existing) {
        if (!members.has(element)) {
          filtered.add(element)
        }
      }
      if (filtered.size === 0) {
        destructive.delete(type)
      } else {
        destructive.set(type, filtered)
      }
    }
  }

  protected async _buildPackages() {
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
      ].map(op => {
        return outputFile(
          join(this.config.output, op.folder, op.filename),
          pc.buildPackage(op.manifest) as string
        )
      })
    )
  }
}
