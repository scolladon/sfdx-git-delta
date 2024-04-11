'use strict'
import StandardHandler from './standardHandler'

export default class DecomposedHandler extends StandardHandler {
  protected override _getElementName() {
    const prefix =
      this.splittedLine[
        this.splittedLine.indexOf(this.metadataDef.directoryName) - 1
      ]
    const elementName = super._getElementName()
    return `${prefix}.${elementName}`
  }
}
