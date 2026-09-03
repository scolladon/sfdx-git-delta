'use strict'
import { join } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import {
  DIGITAL_EXPERIENCE_BUNDLE_DEPTH,
  DIGITAL_EXPERIENCE_CONTENT_DEPTH,
  DIGITAL_EXPERIENCE_TYPE,
  META_REGEX,
} from '../constant/metadataConstants.js'
import InResourceHandler from './inResourceHandler.js'

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const name = this.element.pathAfterType
      .slice(0, DIGITAL_EXPERIENCE_BUNDLE_DEPTH)
      .join(PATH_SEP)
      .replace(META_REGEX, '')
    const suffixExtension = `${DOT}${this.element.type.suffix!}`
    return name.endsWith(suffixExtension)
      ? name.slice(0, -suffixExtension.length)
      : name
  }

  // A page content change deploys as the fine-grained `DigitalExperience` child
  // type (`<baseType>/<spaceApiName>.<contentType>/<contentApiName>`); a change
  // to the bundle meta file (or any non-canonical shallow path) stays a coarse
  // `DigitalExperienceBundle` member that redeploys the whole Experience site.
  public override getElementDescriptor(): { type: string; member: string } {
    const segments = this._pageContentSegments()
    if (!segments) {
      return super.getElementDescriptor()
    }
    const [baseType, spaceApiName, contentType, contentApiName] = segments
    return {
      type: DIGITAL_EXPERIENCE_TYPE,
      member: `${baseType}${PATH_SEP}${spaceApiName}${DOT}${contentType}${PATH_SEP}${contentApiName}`,
    }
  }

  // For a page change, scope the component to the content folder instead of the
  // whole bundle directory. This drives the delete-vs-modify existence check
  // (`InResourceHandler.collectDeletion`), so a single-page edit no longer
  // drags sibling pages along.
  protected override _getMetadataName(): string {
    const segments = this._pageContentSegments()
    if (!segments) {
      return super._getMetadataName()
    }
    return join(this.element.typeDirectoryPath, ...segments)
  }

  // A `DigitalExperience` page keeps its metadata as `_meta.json` inside the
  // content folder (copied by `_collectResourceCopies`), so there is no sibling
  // `-meta.xml` companion to chase.
  protected override _shouldCopyMetaFile(): boolean {
    if (this._pageContentSegments()) {
      return false
    }
    return super._shouldCopyMetaFile()
  }

  // The four canonical content-folder segments
  // `[baseType, spaceApiName, contentType, contentApiName]` when the change is a
  // page content file, or `null` when it targets the bundle itself.
  private _pageContentSegments(): string[] | null {
    const segments = this.element.pathAfterType
    return segments.length > DIGITAL_EXPERIENCE_CONTENT_DEPTH
      ? segments.slice(0, DIGITAL_EXPERIENCE_CONTENT_DEPTH)
      : null
  }
}
