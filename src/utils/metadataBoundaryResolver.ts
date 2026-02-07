'use strict'
import { dirname, parse } from 'node:path/posix'

import GitAdapter from '../adapter/GitAdapter.js'
import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'
import { log } from './LoggingDecorator.js'
import { MetadataElement } from './metadataElement.js'

const MAX_HIERARCHY_DEPTH = 10

export class MetadataBoundaryResolver {
  protected readonly dirCache: Map<string, string[]>

  constructor(
    protected readonly metadataRepo: MetadataRepository,
    protected readonly gitAdapter: GitAdapter
  ) {
    this.dirCache = new Map()
  }

  @log
  public async createElement(
    path: string,
    metadataDef: Metadata,
    revision: string
  ): Promise<MetadataElement> {
    const element = MetadataElement.fromPath(
      path,
      metadataDef,
      this.metadataRepo
    )
    if (element) return element

    return this.scanAndCreateElement(path, metadataDef, revision)
  }

  protected async scanAndCreateElement(
    path: string,
    metadataDef: Metadata,
    revision: string
  ): Promise<MetadataElement> {
    const parts = path.split(PATH_SEP)
    let currentDir = dirname(path)
    let depthCount = 0

    while (
      currentDir &&
      currentDir !== '.' &&
      depthCount < MAX_HIERARCHY_DEPTH
    ) {
      depthCount++
      const cacheKey = `${revision}:${currentDir}`

      let siblings = this.dirCache.get(cacheKey)
      if (siblings === undefined) {
        siblings = await this.gitAdapter.listDirAtRevision(currentDir, revision)
        this.dirCache.set(cacheKey, siblings)
      }

      const componentName = this.findComponentName(siblings)
      if (componentName && this.isNameInPath(parts, componentName)) {
        return MetadataElement.fromScan(
          path,
          metadataDef,
          this.metadataRepo,
          componentName
        )
      }

      currentDir = dirname(currentDir)
    }

    return MetadataElement.fromScan(
      path,
      metadataDef,
      this.metadataRepo,
      parse(path).name
    )
  }

  protected isNameInPath(parts: string[], componentName: string): boolean {
    return parts.some(
      part => part === componentName || part.startsWith(`${componentName}.`)
    )
  }

  protected findComponentName(siblings: string[]): string | null {
    for (const sibling of siblings) {
      const siblingMetadata = this.metadataRepo.get(sibling)
      if (
        siblingMetadata?.suffix &&
        sibling.includes(`.${siblingMetadata.suffix}`)
      ) {
        return this.extractName(sibling, siblingMetadata.suffix)
      }
    }
    return null
  }

  protected extractName(fileName: string, suffix: string): string {
    return fileName.replace(METAFILE_SUFFIX, '').replace(`.${suffix}`, '')
  }
}
