'use strict'
const StandardHandler = require('./standardHandler')
const fs = require('fs')
const path = require('path')
const xml2js = require('xml2js')

const xmlObjectToPackageType = {
  fieldUpdates: 'WorkflowFieldUpdate',
  tasks: 'WorkflowTask',
  alerts: 'WorkflowAlert',
  outboundMessages: 'WorkflowOutboundMessage',
  rules: 'WorkflowRule',
  sharingOwnerRules: 'SharingOwnerRule',
  sharingCriteriaRules: 'SharingCriteriaRule',
  sharingGuestRules: 'SharingGuestRule',
  sharingTerritoryRules: 'SharingTerritoryRule',
}

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
    // set toRemove
    // set toAdd
    // string potentialType
    // string type
    // string lastFullName
    // read diff of the file
    // forEach line
    //  if line contains fullName => store <fullName> value in lastFullName, store potentialType in type
    //  else store <value> in potentialType
    //  if line starts with - and contains fullName
    //   add lastFullName to toRemove
    //  if line starts with +
    //   add lastFullName to toAdd
    // Remove every toAdd elements from toRemove (deal with movement in the file)
  }

  _fillPackageFromFile(packageObject) {
    const data = fs.readFileSync(path.join(this.config.repo, this.line))

    const parser = new xml2js.Parser()
    this.promises.push(
      parser.parseStringPromise(data).then(result =>
        Object.keys(Object.keys(result)[0])
          .filter(x =>
            Object.prototype.hasOwnProperty.call(xmlObjectToPackageType, x)
          )
          .forEach(type =>
            result[Object.keys(result)[0]][type].forEach(value => {
              packageObject[type] = packageObject[type] || new Set()
              packageObject[type].add(
                `${this._getElementName()}.${value.fullName}`
              )
            })
          )
      )
    )
  }
}

module.exports = InFileHandler
