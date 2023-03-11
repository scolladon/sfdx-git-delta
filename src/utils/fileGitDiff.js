'use strict'

const { parseFile } = require('./fsHelper')
const { asArray } = require('./fxpHelper')
const { cloneDeep, isEqual } = require('lodash')

let xmlObjectToPackageType

const extractRootMetadata = fileContent => Object.values(fileContent)?.[1]

const authorizedKeys = fileContent =>
  Object.values(fileContent)
    .flatMap(tag => Object.keys(tag))
    .filter(tag => xmlObjectToPackageType.has(tag))

// composition of asArray and extractRootMetadata
const metadataExtractorFor = fileContent => subType =>
  asArray(extractRootMetadata(fileContent)?.[subType])

class FileGitDiff {
  constructor(parentDirectoryName, config, metadata) {
    this.parentDirectoryName = parentDirectoryName
    this.config = config
    this.metadata = metadata
    xmlObjectToPackageType =
      xmlObjectToPackageType ??
      [...metadata.keys()]
        .filter(meta => metadata.get(meta)?.xmlTag)
        .reduce(
          (acc, meta) => acc.set(metadata.get(meta).xmlTag, metadata.get(meta)),
          new Map()
        )
  }

  async compare(path) {
    const added = new Map()
    const deleted = new Map()
    this.contentAtToRef = await parseFile(path, this.config)
    const contentAtFromRef = await parseFile(path, {
      repo: this.config.repo,
      to: this.config.from,
    })

    const getToMetadataFor = metadataExtractorFor(this.contentAtToRef)
    const getFromMetadataFor = metadataExtractorFor(contentAtFromRef)

    // Compute added
    authorizedKeys(this.contentAtToRef).forEach(subType => {
      const childType = `${this.parentDirectoryName}.${subType}`
      const toMeta = getToMetadataFor(subType)
      const fromMeta = getFromMetadataFor(subType)
      toMeta
        .filter(elem => !fromMeta.some(f => f.fullName === elem.fullName))
        .forEach(elem => {
          if (!added.has(childType)) {
            added.set(childType, new Set())
          }
          added.get(childType).add(elem.fullName)
        })
    })

    // Compute deleted (added inverted)
    authorizedKeys(contentAtFromRef).forEach(subType => {
      const childType = `${this.parentDirectoryName}.${subType}`
      const toMeta = getToMetadataFor(subType)
      const fromMeta = getFromMetadataFor(subType)
      fromMeta
        .filter(elem => !toMeta.some(f => f.fullName === elem.fullName))
        .forEach(elem => {
          if (!deleted.has(childType)) {
            deleted.set(childType, new Set())
          }
          deleted.get(childType).add(elem.fullName)
        })
    })

    // Compute changed (same fullname different content)
    authorizedKeys(this.contentAtToRef).forEach(subType => {
      const childType = `${this.parentDirectoryName}.${subType}`
      const toMeta = getToMetadataFor(subType)
      const fromMeta = getFromMetadataFor(subType)
      toMeta
        .filter(elem => {
          const fromElem = fromMeta.find(
            child => child.fullName === elem.fullName
          )
          return !isEqual(fromElem, elem)
        })
        .forEach(elem => {
          if (!added.has(childType)) {
            added.set(childType, new Set())
          }
          added.get(childType).add(elem.fullName)
        })
    })

    this.added = added

    return {
      added,
      deleted,
    }
  }

  async scope() {
    const added = this.added
    const scopedContent = cloneDeep(this.contentAtToRef)
    const getMetadataFor = metadataExtractorFor(this.contentAtToRef)
    const scopedRoot = extractRootMetadata(scopedContent)

    authorizedKeys(this.contentAtToRef).forEach(subType => {
      const meta = getMetadataFor(subType)
      scopedRoot[subType] = meta.filter(elem =>
        added
          .get(xmlObjectToPackageType.get(subType).directoryName)
          ?.has(elem.fullName)
      )
    })

    return scopedContent
  }
}

module.exports = FileGitDiff
