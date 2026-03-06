'use strict'
import { dirname, parse } from 'node:path/posix'

import GitAdapter from '../adapter/GitAdapter.js'
import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'
import { log } from './LoggingDecorator.js'
import { MetadataElement } from './metadataElement.js'

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
    if (element && element.pathAfterType.length <= 1) return element
    if (element && !metadataDef.suffix) return element

    if (element && element.pathAfterType.length === 2) {
      const fileName = element.pathAfterType[1]
      if (fileName.includes(`.${metadataDef.suffix}`)) {
        const componentName = this.extractName(fileName, metadataDef.suffix!)
        if (componentName === element.pathAfterType[0]) {
          return element
        }
        return MetadataElement.fromScan(
          path,
          metadataDef,
          this.metadataRepo,
          componentName
        )
      }
      return element
    }

    return this.scanAndCreateElement(path, metadataDef, revision)
  }

  protected async scanAndCreateElement(
    path: string,
    metadataDef: Metadata,
    revision: string
  ): Promise<MetadataElement> {
    const parts = path.split(PATH_SEP)
    const dirIndex = parts.lastIndexOf(metadataDef.directoryName)

    if (dirIndex >= 0 && metadataDef.suffix) {
      const typeDir = parts.slice(0, dirIndex + 1).join(PATH_SEP)
      let allFiles: string[]
      try {
        allFiles = await this.gitAdapter.getFilesPath(typeDir, revision)
      } catch {
        allFiles = []
      }
      const metaSuffix = `.${metadataDef.suffix}${METAFILE_SUFFIX}`

      const componentNames = new Set<string>()
      for (const file of allFiles) {
        if (file.endsWith(metaSuffix)) {
          const fileName = file.split(PATH_SEP).pop()!
          componentNames.add(this.extractName(fileName, metadataDef.suffix))
        }
      }

      const pathAfterType = parts.slice(dirIndex + 1)
      for (let i = pathAfterType.length - 2; i >= 0; i--) {
        if (componentNames.has(pathAfterType[i])) {
          return MetadataElement.fromScan(
            path,
            metadataDef,
            this.metadataRepo,
            pathAfterType[i]
          )
        }
      }

      return MetadataElement.fromScan(
        path,
        metadataDef,
        this.metadataRepo,
        parse(path).name
      )
    }

    let currentDir = dirname(path)
    while (currentDir && currentDir !== '.') {
      const cacheKey = `${revision}:${currentDir}`

      let siblings = this.dirCache.get(cacheKey)
      if (siblings === undefined) {
        siblings = await this.gitAdapter.listDirAtRevision(currentDir, revision)
        this.dirCache.set(cacheKey, siblings)
      }

      const componentName = this.findComponentName(siblings, parts)
      if (componentName) {
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

  protected findComponentName(
    siblings: string[],
    parts: string[]
  ): string | null {
    for (const sibling of siblings) {
      const siblingMetadata = this.metadataRepo.get(sibling)
      if (
        siblingMetadata?.suffix &&
        sibling.includes(`.${siblingMetadata.suffix}`)
      ) {
        const name = this.extractName(sibling, siblingMetadata.suffix)
        if (this.isNameInPath(parts, name)) {
          return name
        }
      }
    }
    return null
  }

  protected extractName(fileName: string, suffix: string): string {
    return fileName.replace(METAFILE_SUFFIX, '').replace(`.${suffix}`, '')
  }
}
