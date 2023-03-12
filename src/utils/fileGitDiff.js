'use strict'

const { asArray, parseXmlFileToJson, convertJsonToXml } = require('./fxpHelper')
const { cloneDeep, isEqual } = require('lodash')
const { safeAdd } = require('./packageHelper')

let xmlObjectToPackageType

const extractRootMetadata = fileContent => Object.values(fileContent)?.[1]

const authorizedKeys = fileContent =>
  Object.values(fileContent)
    .flatMap(tag => Object.keys(tag))
    .filter(tag => xmlObjectToPackageType.has(tag))

// composition of asArray and extractRootMetadata
const metadataExtractorFor = fileContent => subType =>
  asArray(extractRootMetadata(fileContent)?.[subType])

const diffForRootType =
  dirName => (contentAtRef, otherExtractor, store, predicat) => {
    authorizedKeys(contentAtRef).forEach(subType => {
      const type = `${dirName}.${subType}`
      const baseExtractor = metadataExtractorFor(contentAtRef)
      const baseMeta = baseExtractor(subType)
      const otherMeta = otherExtractor(subType)
      baseMeta
        .filter(elem => predicat(otherMeta, elem))
        .forEach(elem => safeAdd({ store, type, elementName: elem.fullName }))
    })
  }

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
    this.added = new Map()
    const deleted = new Map()
    this.contentAtToRef = await parseXmlFileToJson(path, this.config)
    const contentAtFromRef = await parseXmlFileToJson(path, {
      repo: this.config.repo,
      to: this.config.from,
    })

    const extractToMetadata = metadataExtractorFor(this.contentAtToRef)
    const extractFromMetadata = metadataExtractorFor(contentAtFromRef)
    const diff = diffForRootType(this.parentDirectoryName)

    // Added or Modified
    diff(this.contentAtToRef, extractFromMetadata, this.added, (meta, elem) => {
      const match = meta.find(el => el.fullName === elem.fullName)
      return !match || !isEqual(match, elem)
    })

    // Deleted
    diff(contentAtFromRef, extractToMetadata, deleted, (meta, elem) => {
      return !meta.some(el => el.fullName === elem.fullName)
    })

    return {
      added: this.added,
      deleted,
    }
  }

  pruneContent() {
    const added = this.added
    const scopedJsonContent = cloneDeep(this.contentAtToRef)
    const getMetadataFor = metadataExtractorFor(this.contentAtToRef)
    const scopedRoot = extractRootMetadata(scopedJsonContent)

    authorizedKeys(this.contentAtToRef).forEach(subType => {
      const meta = getMetadataFor(subType)
      scopedRoot[subType] = meta.filter(elem =>
        added
          .get(xmlObjectToPackageType.get(subType).directoryName)
          ?.has(elem.fullName)
      )
    })

    return convertJsonToXml(scopedJsonContent)
  }
}

module.exports = FileGitDiff
