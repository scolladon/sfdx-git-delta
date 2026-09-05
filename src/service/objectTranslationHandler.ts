'use strict'
import { parse } from 'node:path/posix'
import { PATH_SEP } from '../constant/fsConstants.js'
import { OBJECT_TRANSLATION_META_XML_SUFFIX } from '../constant/metadataConstants.js'
import type { HandlerResult } from '../types/handlerResult.js'
import { CopyOperationKind } from '../types/handlerResult.js'
import MetadataDiff from '../utils/metadataDiff/index.js'
import ResourceHandler from './inResourceHandler.js'
import StandardHandler from './standardHandler.js'

export default class ObjectTranslationHandler extends ResourceHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await StandardHandler.prototype.collectAddition.call(this)
    if (!this._shouldCollectCopies()) return result

    // RATIONALE: Why include objectTranslation file even when pruned content is empty?
    // fieldTranslation elements are not deployable without their parent objectTranslation.
    // See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#object-translations
    const objectTranslationPath = this._getObjectTranslationPath()
    const writer = await this._getObjectTranslationWriter(objectTranslationPath)
    const copies = [...result.copies]
    if (writer) {
      copies.push({
        kind: CopyOperationKind.StreamedContent,
        path: objectTranslationPath,
        writer,
      })
    } else {
      this._collectCopy(copies, objectTranslationPath)
    }
    return { ...result, copies }
  }

  protected async _getObjectTranslationWriter(path: string) {
    const inFileMetadata = this.element.getInFileAttributes()
    const metadataDiff = new MetadataDiff(this.config, inFileMetadata)
    const outcome = await metadataDiff.run(path)
    return outcome.writer
  }

  // The parent objectTranslation file always sits in the changed file's own
  // directory, named after the component. Deriving it from the component name
  // rather than from a fixed path position covers both layouts SDR resolves to
  // the same component: the sub-folder form
  // (objectTranslations/Account-es/Account-es.objectTranslation-meta.xml, which
  // also hosts the sibling fieldTranslation files) and the flat form
  // (objectTranslations/Account-es.objectTranslation-meta.xml). A positional
  // `parts.at(-2)` reads the type directory itself in the flat form, yielding
  // objectTranslations/objectTranslations.objectTranslation-meta.xml — a path
  // that matches nothing, so the file silently never reaches the package.
  protected _getObjectTranslationPath() {
    return `${parse(this.element.basePath).dir}${PATH_SEP}${this._getElementName()}.${OBJECT_TRANSLATION_META_XML_SUFFIX}`
  }

  protected override _delegateFileCopy() {
    return !this.element.fullPath.endsWith(OBJECT_TRANSLATION_META_XML_SUFFIX)
  }

  // The parent objectTranslation file is emitted by collectAddition's own
  // writer/fallback branch. Opt out of the inherited meta-file copy, which would
  // otherwise resolve to a bogus path (metadataName is unset on this handler's
  // StandardHandler-direct call) and silently fail downstream.
  protected override _shouldCopyMetaFile() {
    return false
  }

  // NOTE: _getElementName is deliberately NOT overridden here. ResourceHandler
  // already resolves the component name for both layouts described on
  // _getObjectTranslationPath above; narrowing it to `pathAfterType[0]` reads
  // the file's own base name in the flat form and leaks the ".objectTranslation
  // -meta.xml" extension into the package.xml member.
}
