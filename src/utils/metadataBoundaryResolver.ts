'use strict'
import { dirname, parse } from 'node:path/posix'

import GitAdapter from '../adapter/GitAdapter.js'
import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'
import { log } from './LoggingDecorator.js'

const MAX_HIERARCHY_DEPTH = 10

export interface ResolvedMetadata {
  metadata: Metadata
  boundaryIndex: number
  componentName: string
}

export class MetadataBoundaryResolver {
  protected readonly dirCache: Map<string, string[]>

  constructor(
    protected readonly metadataRepo: MetadataRepository,
    protected readonly gitAdapter: GitAdapter
  ) {
    this.dirCache = new Map()
  }

  @log
  public async resolve(
    path: string,
    revision: string
  ): Promise<ResolvedMetadata | null> {
    const parts = path.split(PATH_SEP)

    // 1. FAST: Check if current file itself has a known suffix
    const currentMetadata = this.metadataRepo.get(path)
    if (currentMetadata?.suffix) {
      const fileName = parts[parts.length - 1]
      if (fileName.includes(`.${currentMetadata.suffix}`)) {
        return {
          metadata: currentMetadata,
          boundaryIndex: parts.length - 2,
          componentName: this.extractName(fileName, currentMetadata.suffix),
        }
      }
    }

    // 2. FAST: Check if directoryName is in the path
    if (currentMetadata?.directoryName) {
      const dirIndex = parts.lastIndexOf(currentMetadata.directoryName)
      if (dirIndex >= 0 && dirIndex + 1 < parts.length) {
        const nextPart = parts[dirIndex + 1]
        const isFolder = dirIndex + 1 < parts.length - 1

        if (isFolder) {
          return {
            metadata: currentMetadata,
            boundaryIndex: dirIndex + 1,
            componentName: nextPart,
          }
        }
        return {
          metadata: currentMetadata,
          boundaryIndex: dirIndex,
          componentName: parse(nextPart.replace(METAFILE_SUFFIX, '')).name,
        }
      }
    }

    // 3. Scan hierarchy to find sibling with ANY known suffix
    return this.scanHierarchyFromGit(path, revision)
  }

  protected async scanHierarchyFromGit(
    path: string,
    revision: string
  ): Promise<ResolvedMetadata | null> {
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

      // Get siblings (from cache or git)
      let siblings = this.dirCache.get(cacheKey)
      if (siblings === undefined) {
        siblings = await this.gitAdapter.listDirAtRevision(currentDir, revision)
        this.dirCache.set(cacheKey, siblings)
      }

      // Look for any sibling with a known metadata suffix
      for (const sibling of siblings) {
        const siblingMetadata = this.metadataRepo.get(sibling)
        if (
          siblingMetadata?.suffix &&
          sibling.includes(`.${siblingMetadata.suffix}`)
        ) {
          const componentName = this.extractName(
            sibling,
            siblingMetadata.suffix
          )
          // Find the component folder/file in the path parts
          const boundaryIndex = this.findComponentIndex(parts, componentName)
          if (boundaryIndex >= 0) {
            return {
              metadata: siblingMetadata,
              boundaryIndex,
              componentName,
            }
          }
        }
      }

      currentDir = dirname(currentDir)
    }

    return null
  }

  protected findComponentIndex(parts: string[], componentName: string): number {
    // First try exact match (folder-based component)
    const exactIndex = parts.lastIndexOf(componentName)
    if (exactIndex >= 0) {
      return exactIndex
    }
    // Try to find file that starts with componentName (file-based component)
    for (let i = parts.length - 1; i >= 0; i--) {
      if (parts[i].startsWith(`${componentName}.`)) {
        return i
      }
    }
    return -1
  }

  protected extractName(fileName: string, suffix: string): string {
    // "MyAgent.genAiPlannerBundle-meta.xml" -> "MyAgent"
    return fileName.replace(METAFILE_SUFFIX, '').replace(`.${suffix}`, '')
  }
}
