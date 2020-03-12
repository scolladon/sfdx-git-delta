'use strict'
const fileGitDiff = require('../utils/fileGitDiff')
const gitConstants = require('../utils/gitConstants')
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
    this._handleInFile()
  }

  handleModification() {
    this
      ._handleInFile //toAdd => {
      // TODO Remove all element of the file not contained in the toAdd set
      // readFile
      // Parse json
      // iterate over each sub type
      //  filter each element if toAdd do not have fullName
      // write file
      //}
      ()
  }

  _handleInFile(cb) {
    this.promises.push(
      fileGitDiff(this.line, this.config).then(diffContent => {
        let toRemove = new Set()
        const toAdd = new Set()
        let potentialType, type, fullName
        diffContent.split(os.EOL).forEach(line => {
          if (FULLNAME_XML_TAG.test(line)) {
            fullName = line.match(FULLNAME_XML_TAG)[1]
            type = potentialType
          } else if (XML_TAG.test(line)) {
            potentialType = line.match(XML_TAG)[1]
          }

          if (!!type && !!fullName) {
            if (
              line.startsWith(gitConstants.SUPPRESSION_TAG) &&
              line.includes(FULLNAME)
            ) {
              toRemove.add({ type: type, fullName: fullName })
            } else if (line.startsWith(gitConstants.ADDITION_TAG)) {
              toAdd.add({ type: type, fullName: fullName })
            }
          }
        })
        toRemove = new Set([...toRemove].filter(x => !toAdd.has(x)))

        toAdd.forEach(element =>
          this._fillPackageFromDiff(
            this.diffs.package,
            element.type,
            element.fullName
          )
        )
        toRemove.forEach(element =>
          this._fillPackageFromDiff(
            this.diffs.destructiveChanges,
            element.type,
            element.fullName
          )
        )
        cb && cb(toAdd)
      })
    )
  }

  _fillPackageFromFile(packageObject) {
    const data = fs.readFileSync(path.join(this.config.repo, this.line))

    const parser = new xml2js.Parser()
    this.promises.push(
      parser.parseStringPromise(data).then(result => {
        const metadataContent = Object.values(result)[0]
        const metadataTypes = Object.keys(metadataContent)

        metadataTypes
          .filter(x =>
            Object.prototype.hasOwnProperty.call(xmlObjectToPackageType, x)
          )
          .forEach(type => {
            metadataContent[type].forEach(value =>
              this._fillPackageFromDiff(packageObject, type, value.fullName[0])
            )
          })
      })
    )
  }

  _fillPackageFromDiff(packageObject, type, value) {
    console.log('packageObject ' + JSON.stringify(packageObject))
    console.log('type ' + type)
    console.log('value ' + value)
    const elementFullName =
      '' + (type !== 'labels' ? `${this._getElementName()}.` : '') + value
    console.log('elementFullName ' + elementFullName)
    packageObject[type] = packageObject[type] || new Set()
    packageObject[type].add(elementFullName)
    console.log(
      'packageObject[type] ' + JSON.stringify([...packageObject[type]])
    )
  }
}

module.exports = InFileHandler
