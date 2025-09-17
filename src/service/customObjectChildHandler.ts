'use strict'
import StandardHandler from './standardHandler.js'

export default class CustomObjectChildHandler extends StandardHandler {
  protected override _getElementName() {
    const parentTypeSuffix =
      this.splittedLine[
        this.splittedLine.indexOf(this.metadataDef.directoryName) - 1
      ]
    const elementName = super._getElementName()
    return `${parentTypeSuffix}.${elementName}`
  }
}
