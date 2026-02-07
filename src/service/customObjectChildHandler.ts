'use strict'
import StandardHandler from './standardHandler.js'

export default class CustomObjectChildHandler extends StandardHandler {
  protected override _getElementName() {
    const parentTypeSuffix = this._getParentName()
    const elementName = super._getElementName()
    return `${parentTypeSuffix}.${elementName}`
  }

  protected _getParentName(): string {
    return this.element.parentName
  }
}
