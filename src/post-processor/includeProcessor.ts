'use strict'
import GitAdapter from '../adapter/GitAdapter.js'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, DELETION, HEAD } from '../constant/gitConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import DiffLineInterpreter from '../service/diffLineInterpreter.js'
import type { Work } from '../types/work.js'
import { buildIncludeHelper } from '../utils/ignoreHelper.js'

import BaseProcessor from './baseProcessor.js'

type GitChange = typeof ADDITION | typeof DELETION

export default class IncludeProcessor extends BaseProcessor {
  protected readonly gitAdapter: GitAdapter
  constructor(work: Work, metadata: MetadataRepository) {
    super(work, metadata)
    this.gitAdapter = GitAdapter.getInstance(this.config)
  }

  protected _shouldProcess() {
    return !!this.config.include || !!this.config.includeDestructive
  }

  public override async process() {
    if (!this._shouldProcess()) {
      return
    }

    const includeHelper = await buildIncludeHelper(this.config)
    const includeLines = new Map<GitChange, string[]>()
    const gitChanges: GitChange[] = [ADDITION, DELETION]
    const lines: string[] = await this.gitAdapter.getFilesPath(
      this.config.source
    )
    for (const line of lines) {
      gitChanges.forEach((changeType: GitChange) => {
        const changedLine = `${changeType}${TAB}${line}`
        if (!includeHelper.keep(changedLine)) {
          if (!includeLines.has(changeType)) {
            includeLines.set(changeType, [])
          }
          includeLines.get(changeType)?.push(changedLine)
        }
      })
    }

    await this._processIncludes(includeLines)
  }

  protected async _processIncludes(includeLines: Map<GitChange, string[]>) {
    if (includeLines.size === 0) {
      return
    }

    const fromBackup = this.work.config.from
    const firsSHA = await this.gitAdapter.getFirstCommitRef()

    // Compare with the whole history of the repository
    // so it can get full file content for inFile metadata
    // while reusing current way to do it on a minimal scope
    if (includeLines.has(ADDITION)) {
      this.work.config.from = firsSHA
      await this._processLines(includeLines.get(ADDITION)!)
    }

    if (includeLines.has(DELETION)) {
      // Need to invert the SHA pointer for DELETION
      // so all the addition are interpreted has deletion by MetadataDiff
      // for the lines of InFile metadata type
      const tobackup = this.work.config.to
      this.work.config.to = firsSHA
      this.work.config.from = tobackup || HEAD // fallback to HEAD as "--to" can be ""
      await this._processLines(includeLines.get(DELETION)!)
      this.work.config.to = tobackup
    }
    this.work.config.from = fromBackup
  }

  protected async _processLines(lines: string[]) {
    const lineProcessor = new DiffLineInterpreter(this.work, this.metadata)
    await lineProcessor.process(lines)
  }
}
