'use strict'

import { outputFile } from 'fs-extra'
import { ChangeKind } from '../types/handlerResult.js'
import type { Manifest } from '../types/work.js'
import type { RenameBucket } from '../utils/changeSet.js'
import { log } from '../utils/LoggingDecorator.js'
import BaseProcessor from './baseProcessor.js'

type RenameEntry = { from: string; to: string }
type KindBucket = Record<string, string[]>
type RenameTypeBucket = Record<string, RenameEntry[]>
type ChangesManifestOutput = {
  [ChangeKind.Add]: KindBucket
  [ChangeKind.Modify]: KindBucket
  [ChangeKind.Delete]: KindBucket
  [ChangeKind.Rename]: RenameTypeBucket
}

export default class ChangesManifestProcessor extends BaseProcessor {
  @log
  public override async process(): Promise<void> {
    // Path resolution policy (see delta.ts flag parsing):
    //   - bare `-c` is rewritten to <output>/changes.manifest.json at CLI time
    //   - explicit value is resolved against cwd (relative) or used as-is
    //     (absolute) — same convention as --ignore-file etc.
    const targetPath = this.config.changesManifest
    if (!targetPath) return

    // ChangeSet.byChangeKind() already coalesces the delete bucket against
    // add/modify/rename, and removes rename participants from add/delete, so
    // the JSON view never lists the same component twice.
    const view = this.work.changes.byChangeKind()
    const payload: ChangesManifestOutput = {
      [ChangeKind.Add]: this._buildKindBucket(view[ChangeKind.Add]),
      [ChangeKind.Modify]: this._buildKindBucket(view[ChangeKind.Modify]),
      [ChangeKind.Delete]: this._buildKindBucket(view[ChangeKind.Delete]),
      [ChangeKind.Rename]: this._buildRenameBucket(view[ChangeKind.Rename]),
    }
    await outputFile(targetPath, JSON.stringify(payload, null, 2))
  }

  protected _buildKindBucket(manifest: Manifest): KindBucket {
    const bucket: KindBucket = {}
    // `!` is safe: keys come from manifest.keys() so get() cannot be undefined.
    for (const type of [...manifest.keys()].sort()) {
      bucket[type] = [...manifest.get(type)!].sort()
    }
    return bucket
  }

  protected _buildRenameBucket(renames: RenameBucket): RenameTypeBucket {
    const bucket: RenameTypeBucket = {}
    for (const type of [...renames.keys()].sort()) {
      const pairs = [...renames.get(type)!.values()]
        .map(({ from, to }) => ({ from, to }))
        .sort((a, b) => a.to.localeCompare(b.to))
      bucket[type] = pairs
    }
    return bucket
  }
}
