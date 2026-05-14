'use strict'
import { join } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import {
  DIGITAL_EXPERIENCE_TYPE,
  META_REGEX,
} from '../constant/metadataConstants.js'

import InResourceHandler from './inResourceHandler.js'

const suffixRegexCache = new Map<string, RegExp>()

// SDR canonical Digital Experience layout after the `digitalExperiences`
// directory is `<baseType>/<spaceApiName>/<contentType>/<contentApiName>/<file>`:
// a page content file always lives strictly inside that four-segment content
// folder, so `pathAfterType.length > 4` is the structural signature of a
// page-level change. Shorter paths target the bundle itself (its
// `*.digitalExperience-meta.xml`) or a non-canonical layout, and keep the
// coarse `DigitalExperienceBundle` behaviour.
const CONTENT_FOLDER_DEPTH = 4

export default class BundleHandler extends InResourceHandler {
  protected override _getElementName() {
    const suffix = this.element.type.suffix!
    let suffixRegex = suffixRegexCache.get(suffix)
    // Stryker disable next-line ConditionalExpression,BlockStatement -- equivalent: cache short-circuit; flipping to true rebuilds the regex on every call, but the cache+rebuild produce the same RegExp instance shape and the downstream replace operates identically
    if (!suffixRegex) {
      suffixRegex = new RegExp(`\\.${suffix}$`)
      suffixRegexCache.set(suffix, suffixRegex)
    }
    return this.element.pathAfterType
      .slice(0, 2)
      .join(PATH_SEP)
      .replace(META_REGEX, '')
      .replace(suffixRegex, '')
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
  // whole bundle directory. This drives both the delete-vs-modify existence
  // check (`InResourceHandler.collectDeletion`) and the copy scan
  // (`InResourceHandler._collectResourceCopies`), so a single-page edit no
  // longer drags sibling pages along.
  protected override _getMetadataName(): string {
    const segments = this._pageContentSegments()
    if (!segments) {
      return super._getMetadataName()
    }
    return join(this.element.typeDirectoryPath, ...segments)
  }

  // A `DigitalExperience` page keeps its metadata as `_meta.json` inside the
  // content folder (already picked up by `_collectResourceCopies`), so there is
  // no sibling `-meta.xml` companion to chase.
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
    return segments.length > CONTENT_FOLDER_DEPTH
      ? segments.slice(0, CONTENT_FOLDER_DEPTH)
      : null
  }
}
