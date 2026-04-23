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
    const pc = new PackageBuilder(this.config)
    // ChangeSet.forDestructiveManifest() already cancels delete entries that
    // have been re-added or re-modified in the same diff — no local cleanup
    // needed here.
    const destructiveManifest = this.work.changes.forDestructiveManifest()
    const packageManifest = this.work.changes.forPackageManifest()
    await Promise.all(
      [
        {
          filename: `${DESTRUCTIVE_CHANGES_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: DESTRUCTIVE_CHANGES_FILE_NAME,
          manifest: destructiveManifest,
        },
        {
          filename: `${PACKAGE_FILE_NAME}.${XML_FILE_EXTENSION}`,
          folder: PACKAGE_FILE_NAME,
          manifest: packageManifest,
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
