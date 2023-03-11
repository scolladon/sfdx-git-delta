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

const diff =
  dirName => (contentAtRef, baseExtractor, otherExtractor, store, predicat) => {
    predicat =
      predicat ??
      (otherMeta => elem => !otherMeta.some(f => f.fullName === elem.fullName))
    authorizedKeys(contentAtRef).forEach(subType => {
      const childType = `${dirName}.${subType}`
      const baseMeta = baseExtractor(subType)
      const otherMeta = otherExtractor(subType)
      baseMeta
        .filter(elem => predicat(otherMeta)(elem))
        .forEach(elem => safeAdd(store)(childType)(elem.fullName))
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
    const added = new Map()
    const deleted = new Map()
    const contentAtToRef = await parseXmlFileToJson(path, this.config)
    const contentAtFromRef = await parseXmlFileToJson(path, {
      repo: this.config.repo,
      to: this.config.from,
    })

    const getToMetadataFor = metadataExtractorFor(contentAtToRef)
    const getFromMetadataFor = metadataExtractorFor(contentAtFromRef)
    const diffForDir = diff(this.parentDirectoryName)

    // added elements
    diffForDir(contentAtToRef, getToMetadataFor, getFromMetadataFor, added)

    // deleted elements
    diffForDir(contentAtFromRef, getFromMetadataFor, getToMetadataFor, deleted)

    // modified elements
    diffForDir(
      contentAtToRef,
      getToMetadataFor,
      getFromMetadataFor,
      added,
      otherMeta => elem => {
        const otherElem = otherMeta.find(
          child => child.fullName === elem.fullName
        )
        return !isEqual(otherElem, elem)
      }
    )

    this.added = added
    this.contentAtToRef = contentAtToRef

    return {
      added,
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
