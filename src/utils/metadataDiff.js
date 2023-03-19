'use strict'

const { asArray, parseXmlFileToJson, convertJsonToXml } = require('./fxpHelper')
const { isEqual } = require('lodash')
const { safeAdd } = require('./packageHelper')

const hasProp = (object, key) => ({}.hasOwnProperty.call(object, key))

// Store functional area
// Side effect on store
const addToStore =
  store =>
  ({ type, member }) => {
    safeAdd({ store, type, member })
    return store
  }

const hasMember = store => attributs => subType => member =>
  store.get(attributs[subType]?.xmlName)?.has(member)

// Metadata JSON structure functional area
const getRootMetadata = fileContent => Object.values(fileContent)?.[1] ?? {}

const clearMetadata = fileContent => ({
  ...fileContent,
  [Object.keys(fileContent)[1]]: {},
})

const getSubTypeTags = attributs => fileContent =>
  Object.keys(getRootMetadata(fileContent)).filter(tag =>
    hasProp(attributs, tag)
  )

const extractMetadataForSubtype = fileContent => subType =>
  asArray(getRootMetadata(fileContent)?.[subType])

// Diff processing functional area
const compareContent = attributs => (contentAtRef, otherContent, predicat) =>
  getSubTypeTags(attributs)(contentAtRef)
    .flatMap(
      processMetadataForSubType(contentAtRef, otherContent, predicat, attributs)
    )
    .reduce((store, nameByType) => addToStore(store)(nameByType), new Map())

const processMetadataForSubType =
  (baseContent, otherContent, predicat, attributs) => subType => {
    const baseMeta = extractMetadataForSubtype(baseContent)(subType)
    const otherMeta = extractMetadataForSubtype(otherContent)(subType)
    const processElement = getElementProcessor(
      subType,
      predicat,
      otherMeta,
      attributs
    )
    return baseMeta.map(processElement).filter(x => x !== undefined)
  }

const getElementProcessor = (type, predicat, otherMeta, attributs) => elem => {
  if (predicat(otherMeta, elem)) {
    return { type: attributs[type].xmlName, member: elem[attributs[type].key] }
  }
}

// Partial JSON generation functional area
const generatePartialJSON = attributs => jsonContent => store => {
  const extract = extractMetadataForSubtype(jsonContent)
  const storeHasMember = hasMember(store)(attributs)
  return getSubTypeTags(attributs)(jsonContent).reduce((acc, subType) => {
    const meta = extract(subType)
    const storeHasMemberForType = storeHasMember(subType)
    const rootMetadata = getRootMetadata(acc)
    rootMetadata[subType] = meta.filter(elem =>
      storeHasMemberForType(elem.fullName)
    )
    return acc
  }, clearMetadata(jsonContent))
}

class MetadataDiff {
  constructor(config, metadata, attributs) {
    this.config = config
    this.metadata = metadata
    this.attributs = attributs
    this.configTo = {
      repo: this.config.repo,
      to: this.config.to,
    }
    this.configFrom = {
      repo: this.config.repo,
      to: this.config.from,
    }
  }

  async compare(path) {
    this.toContent = await parseXmlFileToJson(path, this.configTo)
    const fromContent = await parseXmlFileToJson(path, this.configFrom)

    const diff = compareContent(this.attributs)

    // Added or Modified
    this.add = diff(this.toContent, fromContent, (meta, elem) => {
      const match = meta.find(el => el.fullName === elem.fullName)
      return !match || !isEqual(match, elem)
    })

    // Will be done when not needed
    // Deleted
    const del = diff(fromContent, this.toContent, (meta, elem) => {
      return !meta.some(el => el.fullName === elem.fullName)
    })

    return {
      added: this.add,
      deleted: del,
      jsonContent: this.toContent,
    }
  }

  //prune(jsonContent = this.toContent, elements = this.add, predicat) {
  prune(jsonContent = this.toContent, elements = this.add) {
    const prunedContent = generatePartialJSON(this.attributs)(jsonContent)(
      elements
    )
    return convertJsonToXml(prunedContent)
  }
}

module.exports = MetadataDiff
