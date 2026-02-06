'use strict'
import StandardHandler from './standardHandler.js'

export default class CustomObjectChildHandler extends StandardHandler {
  protected override _getElementName() {
    const parentTypeSuffix = this._getParentName()
    const elementName = super._getElementName()
    return `${parentTypeSuffix}.${elementName}`
  }

  protected _getParentName(): string {
    // Use resolver to find the correct index if available
    if (this.resolvedMetadata) {
      // directoryName (like 'fields') is typically at boundaryIndex - 1
      // parent object name is one level before that
      const dirIndex = this.splittedLine.indexOf(this.metadataDef.directoryName)
      if (dirIndex >= 0) {
        return this.splittedLine[dirIndex - 1]
      }
      // Fallback: parent is 2 levels up from component
      return this.splittedLine[this.resolvedMetadata.boundaryIndex - 2] ?? ''
    }
    return this.splittedLine[
      this.splittedLine.indexOf(this.metadataDef.directoryName) - 1
    ]
  }
}
