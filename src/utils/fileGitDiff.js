'use strict'

const { asArray, parseXmlFileToJson, convertJsonToXml } = require('./fxpHelper')
const { isEqual } = require('lodash')
const { safeAdd } = require('./packageHelper')

let xmlObjectToPackageType

// Store functional area
// Side effect on store
const addToStore =
  store =>
  ({ type, member }) => {
    safeAdd({ store, type, member })
    return store
  }

const hasMember = store => subType => member =>
  store.get(getDirectoryNameForSubType(subType))?.has(member)

// Metadata functional area
const getMetadataByKey = metadata => meta => metadata.get(meta)

const getXmlTagToTypeDefinitionMap = metadata => {
  const extractType = getMetadataByKey(metadata)
  return [...metadata.keys()]
    .filter(meta => extractType(meta)?.xmlTag)
    .reduce((acc, meta) => {
      const typeDef = extractType(meta)
      acc.set(typeDef.xmlTag, typeDef)
      return acc
    }, new Map())
}

// Metadata JSON structure functional area
const getRootMetadata = fileContent => Object.values(fileContent)?.[1]

const clearMetadata = fileContent => ({
  ...fileContent,
  [Object.keys(fileContent)[1]]: {},
})

const getDirectoryNameForSubType = subType =>
  xmlObjectToPackageType.get(subType).directoryName

const getSubTypeTags = fileContent =>
  Object.values(fileContent)
    .flatMap(tag => Object.keys(tag))
    .filter(tag => xmlObjectToPackageType.has(tag))

const extractMetadataForSubtype = fileContent => subType =>
  asArray(getRootMetadata(fileContent)?.[subType])

// Diff processing functional area
const processMetadataForRootType =
  dir => (contentAtRef, otherContent, predicat) =>
    getSubTypeTags(contentAtRef)
      .flatMap(
        processMetadataForSubType(dir, contentAtRef, otherContent, predicat)
      )
      .reduce((store, nameByType) => addToStore(store)(nameByType), new Map())

const processMetadataForSubType =
  (dir, baseContent, otherContent, predicat) => subType => {
    const type = `${dir}.${subType}`
    const baseMeta = extractMetadataForSubtype(baseContent)(subType)
    const otherMeta = extractMetadataForSubtype(otherContent)(subType)
    const processElement = getElementProcessor(type, predicat, otherMeta)
    return baseMeta.map(processElement).filter(x => x !== undefined)
  }

const getElementProcessor = (type, predicat, otherMeta) => elem => {
  if (predicat(otherMeta, elem)) {
    return { type, member: elem.fullName }
  }
}

// Partial JSON generation functional area
const generatePartialJSON = jsonContent => store => {
  const extract = extractMetadataForSubtype(jsonContent)
  const storeHasMember = hasMember(store)
  return getSubTypeTags(jsonContent).reduce((acc, subType) => {
    const meta = extract(subType)
    const storeHasMemberForType = storeHasMember(subType)
    const rootMetadata = getRootMetadata(acc)
    rootMetadata[subType] = meta.filter(elem =>
      storeHasMemberForType(elem.fullName)
    )
    return acc
  }, clearMetadata(jsonContent))
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
      xmlObjectToPackageType ?? getXmlTagToTypeDefinitionMap(metadata)
  }

  async compare(path) {
    this.toContent = await parseXmlFileToJson(path, this.configTo)
    const fromContent = await parseXmlFileToJson(path, this.configFrom)

    const diff = processMetadataForRootType(this.parentDirectoryName)

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
    const prunedContent = generatePartialJSON(this.toContent)(this.added)
    return convertJsonToXml(prunedContent)
  }
}

module.exports = FileGitDiff
