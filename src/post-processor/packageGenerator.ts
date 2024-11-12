'use strict'

import { join } from 'path/posix'

import { outputFile } from 'fs-extra'

import PackageBuilder from '../utils/packageHelper'

import BaseProcessor from './baseProcessor'

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

export default class PackageGenerator extends BaseProcessor {
  public override async process() {
    this._cleanPackages()
    await this._buildPackages()
  }

  protected _cleanPackages() {
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
