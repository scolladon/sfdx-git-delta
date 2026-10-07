'use strict'
import { join, parse } from 'node:path/posix'

import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import type { CopyOperation, HandlerResult } from '../types/handlerResult.js'
import { emptyResult, ManifestTarget } from '../types/handlerResult.js'
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
  // is a change to redeploy. Only the definition's own deletion destroys the
  // registration, so a schema whose definition reads absent (unindexed tree,
  // mismatched name) can never delete a live registration.
  public override async collectDeletion(): Promise<HandlerResult> {
    if (!this._isSchemaFile()) return await super.collectDeletion()
    const definition = this._definitionPath()
    if (!(await pathExists(definition, this.ctx))) return emptyResult()
    return this._redeploy(definition)
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

  private _redeploy(definition: string): HandlerResult {
    const copies: CopyOperation[] = []
    this._collectCopy(copies, definition)
    return {
      elements: [this._collectManifestElement(ManifestTarget.Package)],
      copies,
      warnings: [],
    }
  }

  private _definitionPath() {
    return this._componentFile(`${this.element.type.suffix}${METAFILE_SUFFIX}`)
  }

  private _schemaPath() {
    return this._componentFile(SCHEMA_EXTENSION)
  }

  private _componentFile(fileSuffix: string) {
    const dir = parse(this.element.basePath).dir
    return join(dir, `${this.element.componentName}.${fileSuffix}`)
  }
}
