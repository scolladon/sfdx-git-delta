'use strict'

const { asArray, parseXmlFileToJson, convertJsonToXml } = require('./fxpHelper')
const { isEqual } = require('lodash')
const { fillPackageWithParameter } = require('./packageHelper')

// Store functional area
// Side effect on store
const addToStore =
  store =>
  ({ type, member }) => {
    fillPackageWithParameter({ store, type, member })
    return store
  }

const hasMember = store => attributes => subType => member =>
  store.get(attributes.get(subType)?.xmlName)?.has(member)

const selectKey = attributes => type => elem => elem[attributes.get(type).key]

// Metadata JSON structure functional area
const getRootMetadata = fileContent => Object.values(fileContent)?.[1] ?? {}

const getSubTypeTags = attributes => fileContent =>
  Object.keys(getRootMetadata(fileContent)).filter(tag => attributes.has(tag))

const extractMetadataForSubtype = fileContent => subType =>
  asArray(getRootMetadata(fileContent)?.[subType])

// Diff processing functional area
const compareContent = attributes => (contentAtRef, otherContent, predicat) =>
  getSubTypeTags(attributes)(contentAtRef)
    .flatMap(
      processMetadataForSubType(
        contentAtRef,
        otherContent,
        predicat,
        attributes
      )
    )
    .reduce((store, nameByType) => addToStore(store)(nameByType), new Map())

const processMetadataForSubType =
  (baseContent, otherContent, predicat, attributes) => subType => {
    const baseMeta = extractMetadataForSubtype(baseContent)(subType)
    const otherMeta = extractMetadataForSubtype(otherContent)(subType)
    const processElement = getElementProcessor(
      subType,
      predicat,
      otherMeta,
      attributes
    )
    return baseMeta.map(processElement).filter(x => x !== undefined)
  }

const getElementProcessor = (type, predicat, otherMeta, attributes) => elem => {
  if (predicat(otherMeta, type, elem)) {
    return {
      type: attributes.get(type).xmlName,
      member: selectKey(attributes)(type)(elem),
    }
  }
}

// Partial JSON generation functional are
// Side effect on jsonContent
const generatePartialJSON = attributes => jsonContent => store => {
  const extract = extractMetadataForSubtype(jsonContent)
  const storeHasMember = hasMember(store)(attributes)
  return getSubTypeTags(attributes)(jsonContent).reduce((acc, subType) => {
    const meta = extract(subType)
    const storeHasMemberForType = storeHasMember(subType)
    const key = selectKey(attributes)(subType)
    const rootMetadata = getRootMetadata(acc)
    rootMetadata[subType] = meta.filter(elem =>
      storeHasMemberForType(key(elem))
    )
    return acc
  }, jsonContent)
}

class MetadataDiff {
  constructor(config, metadata, attributes) {
    this.config = config
    this.metadata = metadata
    this.attributes = attributes
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

    const diff = compareContent(this.attributes)

    // Added or Modified
    this.add = diff(this.toContent, fromContent, (meta, type, elem) => {
      const key = selectKey(this.attributes)(type)
      const match = meta.find(el => key(el) === key(elem))
      return !match || !isEqual(match, elem)
    })

    // Will be done when not needed
    // Deleted
    const del = diff(fromContent, this.toContent, (meta, type, elem) => {
      const key = selectKey(this.attributes)(type)
      return !meta.some(el => key(el) === key(elem))
    })

    return {
      added: this.add,
      deleted: del,
      jsonContent: this.toContent,
    }
  }

  prune(jsonContent = this.toContent, elements = this.add) {
    const prunedContent = generatePartialJSON(this.attributes)(jsonContent)(
      elements
    )
    return convertJsonToXml(prunedContent)
  }
}

module.exports = MetadataDiff
