'use strict'

import { createWriteStream, promises as fsPromises } from 'node:fs'
import { dirname, join } from 'node:path/posix'
import type { Manifest } from '../types/work.js'
import { log } from '../utils/LoggingDecorator.js'
import PackageBuilder from '../utils/packageHelper.js'
import BaseProcessor from './baseProcessor.js'

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges'
const PACKAGE_FILE_NAME = 'package'
const XML_FILE_EXTENSION = 'xml'

type WriteOp = {
  filename: string
  folder: string
  manifest: Manifest
}

export default class PackageGenerator extends BaseProcessor {
  @log
  public override async process() {
    const builder = new PackageBuilder(this.config)
    // ChangeSet.forDestructiveManifest() already cancels delete entries that
    // have been re-added or re-modified in the same diff — no local cleanup
    // needed here.
    const destructiveManifest = this.work.changes.forDestructiveManifest()
    const packageManifest = this.work.changes.forPackageManifest()
    const ops: WriteOp[] = [
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
    ]
    await Promise.all(ops.map(op => this._writeManifest(builder, op)))
  }

  private async _writeManifest(
    builder: PackageBuilder,
    op: WriteOp
  ): Promise<void> {
    const dst = join(this.config.output, op.folder, op.filename)
    await fsPromises.mkdir(dirname(dst), { recursive: true })
    const ws = createWriteStream(dst)
    await builder.buildPackageStream(op.manifest, ws)
    await new Promise<void>((resolve, reject) => {
      /* v8 ignore next -- defensive: createWriteStream's end-callback fires with err only on synchronous fd write failure */
      ws.end((err?: Error | null) => (err ? reject(err) : resolve()))
    })
  }
}
