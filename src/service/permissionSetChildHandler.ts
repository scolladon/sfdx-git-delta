'use strict'
import { PATH_SEP } from '../constant/fsConstants.js'
import StandardHandler from './standardHandler.js'

export default class PermissionSetChildHandler extends StandardHandler {
  protected override _getElementName() {
    const parentType = this.element.getParentType()
    if (!parentType) return this.element.componentName

    const parts = this.element.fullPath.split(PATH_SEP)
    const parentDirIndex = parts.lastIndexOf(parentType.directoryName)
    if (parentDirIndex < 0) return this.element.componentName

    const segmentsAfterParentDir = parts.length - parentDirIndex - 1
    if (segmentsAfterParentDir <= 1) {
      // Beta2 flat: file directly in permissionsets/, componentName has PS name
      return this.element.componentName
    }

    // Beta or objectSettings: PS name is first segment after parent directory
    const psName = parts[parentDirIndex + 1]
    return `${psName}.${this.element.componentName}`
  }
}
