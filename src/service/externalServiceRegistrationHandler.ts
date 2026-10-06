'use strict'
import { join, parse } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import { ManifestTarget } from '../types/handlerResult.js'
import { pathExists } from '../utils/fsHelper.js'
import StandardHandler from './standardHandler.js'

// SDR's decomposeExternalServiceRegistration transformer always writes the
// schema as `<name>.yaml`, converting JSON schemas on the way out.
const SCHEMA_EXTENSION = 'yaml'

export default class ExternalServiceRegistrationHandler extends StandardHandler {
  public override async collectAddition(): Promise<HandlerResult> {
    const result = await super.collectAddition()
    const copies = [...result.copies]
    await this._collectLiveCopy(copies, this._siblingPath())
    return { ...result, copies }
  }

  // The registration is one component split across two files and cannot be
  // partially deleted: while its definition survives, losing the schema file
  // is a change to redeploy, never a deletion.
  public override async collectDeletion(): Promise<HandlerResult> {
    if (!(await pathExists(this._definitionPath(), this.ctx))) {
      return await super.collectDeletion()
    }
    const copies: CopyOperation[] = []
    this._collectCopy(copies, this._definitionPath())
    return {
      elements: [this._collectManifestElement(ManifestTarget.Package)],
      copies,
      warnings: [],
    }
  }

  protected override _isProcessable() {
    return super._isProcessable() || this._isSchemaFile()
  }

  private _isSchemaFile() {
    return this.element.extension === SCHEMA_EXTENSION
  }

  private _siblingPath() {
    return this._isSchemaFile() ? this._definitionPath() : this._schemaPath()
  }

  private async _collectLiveCopy(copies: CopyOperation[], path: string) {
    if (!this._shouldCollectCopies()) return
    if (await pathExists(path, this.ctx)) this._collectCopy(copies, path)
  }

  private _definitionPath() {
    return this._componentFile(`${this.element.type.suffix}${METAFILE_SUFFIX}`)
  }

  private _schemaPath() {
    return this._componentFile(SCHEMA_EXTENSION)
  }

  private _componentFile(extension: string) {
    const dir = parse(this.element.basePath).dir
    return join(dir, `${this.element.componentName}.${extension}`)
  }
}
