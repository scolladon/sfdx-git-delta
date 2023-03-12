'use strict'

const { asArray, parseXmlFileToJson, convertJsonToXml } = require('./fxpHelper')
const { isEqual } = require('lodash')
const { safeAdd } = require('./packageHelper')

let xmlObjectToPackageType

// Store functional area
// Side effect on store
const addMember =
  store =>
  ({ type, member }) => {
    safeAdd({ store, type, member })
    return store
  }

const contains = store => subType => fullName =>
  store.get(getSubTypeDirName(subType))?.has(fullName)

// Metadata functional area
const extractMetadata = metadata => meta => metadata.get(meta)

const getChildMetadataDefinition = metadata => {
  const extractType = extractMetadata(metadata)
  return [...metadata.keys()]
    .filter(meta => extractType(meta)?.xmlTag)
    .reduce((acc, meta) => {
      const typeDef = extractType(meta)
      acc.set(typeDef.xmlTag, typeDef)
      return acc
    }, new Map())
}

// Metadata JSON structure functional area
const extractRootMetadata = fileContent => Object.values(fileContent)?.[1]

const copyWithEmptyMetadata = fileContent => ({
  ...fileContent,
  [Object.keys(fileContent)[1]]: {},
})

const getSubTypeDirName = subType =>
  xmlObjectToPackageType.get(subType).directoryName

const authorizedKeys = fileContent =>
  Object.values(fileContent)
    .flatMap(tag => Object.keys(tag))
    .filter(tag => xmlObjectToPackageType.has(tag))

const metadataExtractorFor = fileContent => subType =>
  asArray(extractRootMetadata(fileContent)?.[subType])

// Diff processing functional area
const diffForRootType = dirName => (contentAtRef, otherContent, predicat) =>
  authorizedKeys(contentAtRef)
    .flatMap(processSubType(dirName, contentAtRef, otherContent, predicat))
    .reduce((store, nameByType) => addMember(store)(nameByType), new Map())

const processSubType =
  (dirName, baseContent, otherContent, predicat) => subType => {
    const type = `${dirName}.${subType}`
    const extractBase = metadataExtractorFor(baseContent)
    const extreactOther = metadataExtractorFor(otherContent)
    const baseMeta = extractBase(subType)
    const otherMeta = extreactOther(subType)
    const processElement = processElementFactory(type, predicat, otherMeta)
    return baseMeta.map(processElement).filter(x => x !== undefined)
  }

const processElementFactory = (type, predicat, otherMeta) => elem => {
  if (predicat(otherMeta, elem)) {
    return { type, member: elem.fullName }
  }
}

// Partial JSON generation functional area
const pruneContentFromStore = jsonContent => store => {
  const extract = metadataExtractorFor(jsonContent)
  const storeContains = contains(store)
  return authorizedKeys(jsonContent).reduce((acc, subType) => {
    const meta = extract(subType)
    const isInType = storeContains(subType)
    const rootMetadata = extractRootMetadata(acc)
    rootMetadata[subType] = meta.filter(elem => isInType(elem.fullName))
    return acc
  }, copyWithEmptyMetadata(jsonContent))
}

class FileGitDiff {
  constructor(parentDirectoryName, config, metadata) {
    this.config = config
    this.parentDirectoryName = parentDirectoryName
    this.metadata = metadata
    this.configTo = {
      repo: this.config.repo,
      to: this.config.to,
    }
    this.configFrom = {
      repo: this.config.repo,
      to: this.config.from,
    }
    xmlObjectToPackageType =
      xmlObjectToPackageType ?? getChildMetadataDefinition(metadata)
  }

  async compare(path) {
    this.toContent = await parseXmlFileToJson(path, this.configTo)
    const fromContent = await parseXmlFileToJson(path, this.configFrom)

    const diff = diffForRootType(this.parentDirectoryName)

    // Added or Modified
    this.added = diff(this.toContent, fromContent, (meta, elem) => {
      const match = meta.find(el => el.fullName === elem.fullName)
      return !match || !isEqual(match, elem)
    })

    // Deleted
    const deleted = diff(fromContent, this.toContent, (meta, elem) => {
      return !meta.some(el => el.fullName === elem.fullName)
    })

    return {
      added: this.added,
      deleted,
    }
  }

  prune() {
    const prunedContent = pruneContentFromStore(this.toContent)(this.added)
    return convertJsonToXml(prunedContent)
  }
}

module.exports = FileGitDiff
