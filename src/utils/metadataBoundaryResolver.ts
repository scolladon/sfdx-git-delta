'use strict'
import { dirname, parse } from 'node:path/posix'

import type { TreeReader } from '../adapter/treeReader.js'
import { PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { MetadataRepository } from '../metadata/MetadataRepository.js'
import type { Metadata } from '../types/metadata.js'
import type { RunContext } from '../types/runContext.js'
import { log } from './LoggingDecorator.js'
import { MetadataElement } from './metadataElement.js'

export class MetadataBoundaryResolver {
  protected readonly dirCache: Map<string, string[]>

  constructor(protected readonly ctx: RunContext) {
    this.dirCache = new Map()
  }

  protected get metadata(): MetadataRepository {
    return this.ctx.metadata
  }

  protected get trees(): TreeReader {
    return this.ctx.trees
  }

  @log
  public async createElement(
    path: string,
    metadataDef: Metadata,
    revision: string
  ): Promise<MetadataElement> {
    const element = MetadataElement.fromPath(path, metadataDef, this.metadata)
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
          this.metadata,
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
    const componentName =
      dirIndex >= 0 && metadataDef.suffix
        ? this.findNameUnderTypeDirectory(
            parts,
            dirIndex,
            metadataDef.suffix,
            revision
          )
        : this.findNameInAncestors(path, parts, revision)

    return MetadataElement.fromScan(
      path,
      metadataDef,
      this.metadata,
      componentName ?? parse(path).name
    )
  }

  protected findNameUnderTypeDirectory(
    parts: string[],
    dirIndex: number,
    suffix: string,
    revision: string
  ): string | null {
    const typeDir = parts.slice(0, dirIndex + 1).join(PATH_SEP)
    const componentNames = this.componentNamesUnder(typeDir, suffix, revision)
    const pathAfterType = parts.slice(dirIndex + 1)
    // Stryker disable next-line UpdateOperator -- unaffordable rather than equivalent: with two or more segments after the type directory, i++ keeps `i >= 0` true forever and the mutant hangs until Stryker's timeout; with fewer, the loop never runs in either direction
    for (let i = pathAfterType.length - 2; i >= 0; i--) {
      if (componentNames.has(pathAfterType[i])) return pathAfterType[i]
    }
    return null
  }

  protected componentNamesUnder(
    typeDir: string,
    suffix: string,
    revision: string
  ): Set<string> {
    const metaSuffix = `.${suffix}${METAFILE_SUFFIX}`
    const componentNames = new Set<string>()
    for (const file of this.trees.filesUnder(revision, typeDir)) {
      if (file.endsWith(metaSuffix)) {
        const fileName = file.split(PATH_SEP).pop()!
        componentNames.add(this.extractName(fileName, suffix))
      }
    }
    return componentNames
  }

  protected findNameInAncestors(
    path: string,
    parts: string[],
    revision: string
  ): string | null {
    let currentDir = dirname(path)
    // Stryker disable next-line ConditionalExpression,LogicalOperator,BlockStatement,StringLiteral -- unaffordable rather than equivalent: an emptied body, the `''` literal, the `||` swap and the operand true-flip never let `currentDir` reach '.', so those mutants hang until Stryker's timeout (dirname('.') is '.'). The whole-condition false-flip is suppressed as a side effect; it skips the walk, and the tests asserting pathAfterType[0] from a walk would kill it
    while (currentDir && currentDir !== '.') {
      const siblings = this.siblingsOf(currentDir, revision)
      const componentName = this.findComponentName(siblings, parts)
      if (componentName) return componentName
      currentDir = dirname(currentDir)
    }
    return null
  }

  protected siblingsOf(dir: string, revision: string): string[] {
    const cacheKey = `${revision}:${dir}`
    let siblings = this.dirCache.get(cacheKey)
    if (siblings === undefined) {
      siblings = this.trees.children(revision, dir)
      this.dirCache.set(cacheKey, siblings)
    }
    return siblings
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
      const siblingMetadata = this.metadata.get(sibling)
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
