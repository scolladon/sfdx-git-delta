'use strict'
const DiffHandler = require('../diffHandler')
const StandardHandler = require('./standardHandler')
const fs = require('fs')
const os = require('os')
const path = require('path')
const xml2js = require('xml2js')

const xmlObjectToPackageType = {
  alerts: 'WorkflowAlert',
  fieldUpdates: 'WorkflowFieldUpdate',
  labels: 'CustomLabel',
  outboundMessages: 'WorkflowOutboundMessage',
  rules: 'WorkflowRule',
  sharingCriteriaRules: 'SharingCriteriaRule',
  sharingGuestRules: 'SharingGuestRule',
  sharingOwnerRules: 'SharingOwnerRule',
  sharingTerritoryRules: 'SharingTerritoryRule',
  tasks: 'WorkflowTask',
}

const FULLNAME = 'fullName'
const FULLNAME_XML_TAG = new RegExp(`<${FULLNAME}>(.*)</${FULLNAME}>`)
const XML_TAG = new RegExp('<(.*)>')

class InFileHandler extends StandardHandler {
  handleAddition() {
    super.handleAddition()
    this._fillPackageFromFile(this.diffs.package)
  }

  handleDeletion() {
    super.handleDeletion()
    this._fillPackageFromFile(this.diffs.destructiveChanges)
  }

  handleModification() {
    const diffHandler = new DiffHandler(this.config)
    this.promises.push(
      diffHandler
        .unitDiff(path.join(this.config.repo, this.line))
        .then(diffContent => {
          let toRemove = new Set()
          const toAdd = new Set()
          let potentialType, type, fullName
          diffContent.split(os.EOL).forEach(line => {
            if (FULLNAME_XML_TAG.test(line)) {
              fullName = line.match(FULLNAME_XML_TAG)[1]
              type = potentialType
            } else {
              potentialType = line.match(XML_TAG)
            }

            if (!!type && !!fullName) {
              if (
                line.startsWith(DiffHandler.SUPPRESSION_TAG) &&
                line.includes(FULLNAME)
              ) {
                toRemove.push({ type: type, fullName: fullName })
              } else if (line.startsWith(DiffHandler.ADDITION_TAG)) {
                toAdd.push({ type: type, fullName: fullName })
              }
            }
          })
          toRemove = toRemove.difference(toAdd)

          toAdd.forEach(element =>
            this.__fillPackageFromDiff(
              this.diffs.package,
              element.type,
              element.fullName
            )
          )
          toRemove.forEach(element =>
            this.__fillPackageFromDiff(
              this.diffs.destructiveChanges,
              element.type,
              element.fullName
            )
          )
        })
    )
  }

  _fillPackageFromFile(packageObject) {
    const data = fs.readFileSync(path.join(this.config.repo, this.line))

    const parser = new xml2js.Parser()
    this.promises.push(
      parser.parseStringPromise(data).then(result => {
        const metadataFileContent = Object.values(result)[0]
        metadataFileContent
          .filter(x =>
            Object.prototype.hasOwnProperty.call(xmlObjectToPackageType, x)
          )
          .forEach(type =>
            metadataFileContent[type].forEach(value =>
              this.__fillPackageFromDiff(packageObject, type, value.fullName)
            )
          )
      })
    )
  }

  _fillPackageFromDiff(packageObject, type, value) {
    packageObject[type] = packageObject[type] || new Set()
    packageObject[type].add(
      (type !== 'labels' ? `${this._getElementName()}.` : '') + `${value}`
    )
  }
}

module.exports = InFileHandler
