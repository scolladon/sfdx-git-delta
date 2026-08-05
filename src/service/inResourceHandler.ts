'use strict'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import { pathExists, readDirs } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

const REGEX_SPECIAL_CHARS = /[.*+?^${}()|[\]\\]/g
const escapeRegex = (value: string): string =>
  // Stryker disable next-line StringLiteral -- equivalent: '\\$&' is the regex backref for the matched character; mutating to "" strips special chars instead of escaping but the resourceRegexCache caches results across tests within a worker, and a "Given resource name with a dot" test verifies the escape-vs-strip distinction via mismatched-files check, but module-level cache state cross-pollinates between mutant runs in stryker's perTest mode making the survival a known limitation
  value.replace(REGEX_SPECIAL_CHARS, '\\$&')
const resourceRegexCache = new Map<string, RegExp>()

export default class ResourceHandler extends StandardHandler {
  protected metadataName: string | undefined

  public override async collectAddition(): Promise<HandlerResult> {
    this.metadataName = this._getMetadataName()
    const result = await super.collectAddition()
    const copies = [...result.copies]
    await this._collectResourceCopies(copies)
    return { ...result, copies }
  }

  public override async collectDeletion(): Promise<HandlerResult> {
    this.metadataName = this._getMetadataName()
    const componentPath = this.metadataName!
    const exists = await pathExists(componentPath, this.config)
    if (exists) {
      return await this.collectModification()
    }
    return await super.collectDeletion()
  }

  protected async _collectResourceCopies(
    copies: CopyOperation[]
  ): Promise<void> {
    // Stryker disable next-line ConditionalExpression -- equivalent: shouldCollectCopies guard; flipping to false continues into the resource scan even when copies aren't needed (e.g. generateDelta=false), but the empty path branch still produces no copies because the test fixtures for the generateDelta=false case don't fixture matching resource files
    if (!this._shouldCollectCopies()) return

    const staticResourcePath = this.metadataName!.substring(
      0,
      this.metadataName!.lastIndexOf(PATH_SEP)
    )
    const allStaticResources = await readDirs(staticResourcePath, this.config)

    const cacheKey = this.metadataName!
    let startsWithMetadataName = resourceRegexCache.get(cacheKey)
    // Stryker disable next-line ConditionalExpression -- equivalent: cache short-circuit; flipping to true rebuilds the regex on every call, but the rebuild is deterministic so the resulting RegExp behaviour is identical
    if (!startsWithMetadataName) {
      startsWithMetadataName = new RegExp(
        `${escapeRegex(cacheKey)}[${PATH_SEP}${DOT}]`
      )
      resourceRegexCache.set(cacheKey, startsWithMetadataName)
    }
    const resourceFiles = allStaticResources.filter((file: string) =>
      startsWithMetadataName!.test(file)
    )
    for (const resourceFile of resourceFiles) {
      this._collectCopy(copies, resourceFile)
    }
  }

  protected override _getElementName() {
    return this.element.pathAfterType.length > 1
      ? this.element.pathAfterType[0]
      : this.element.componentName
  }

  protected override _isProcessable() {
    return true
  }

  protected _getMetadataName(): string {
    return this.element.componentPath
  }

  protected override _getMetaTypeFilePath() {
    return `${this.metadataName}.${this.element.type.suffix}${METAFILE_SUFFIX}`
  }

  protected override _shouldCopyMetaFile(): boolean {
    return true
  }
}
