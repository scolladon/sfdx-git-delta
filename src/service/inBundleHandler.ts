'use strict'
import { join } from 'node:path/posix'

import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import {
  DIGITAL_EXPERIENCE_TYPE,
  META_REGEX,
} from '../constant/metadataConstants.js'
import type { CopyOperation } from '../types/handlerResult.js'

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

// A `DigitalExperience` deploy is a merge but the Metadata API rejects a page
// folder missing either of these two core files (verified against a real org).
// Untouched siblings (locales, css, media) can stay in the org, so a page
// change ships the changed file plus only these two mandatory files.
const PAGE_META_FILE = '_meta.json'
const PAGE_CONTENT_FILE = 'content.json'

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

  // For a page change, copy only the two mandatory core files alongside the
  // changed file (already copied by `_collectCopyWithMetaFile`) — not the whole
  // content folder. `DigitalExperience` deploys merge, so untouched siblings
  // stay in the org. Bundle elements keep the inherited whole-directory scan.
  protected override async _collectResourceCopies(
    copies: CopyOperation[]
  ): Promise<void> {
    if (!this._pageContentSegments()) {
      return super._collectResourceCopies(copies)
    }
    // page element: _getMetadataName() resolves to the content folder
    const contentFolder = this._getMetadataName()
    for (const coreFile of [PAGE_META_FILE, PAGE_CONTENT_FILE]) {
      const corePath = join(contentFolder, coreFile)
      // the changed file is already collected by `_collectCopyWithMetaFile`
      if (corePath !== this.element.basePath) {
        this._collectCopy(copies, corePath)
      }
    }
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
    return segments.length > CONTENT_FOLDER_DEPTH
      ? segments.slice(0, CONTENT_FOLDER_DEPTH)
      : null
  }
}
