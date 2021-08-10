'use strict'
import StandardHandler from './standardHandler'
import { UTF8_ENCODING } from '../utils/gitConstants'
import {
  FIELD_DIRECTORY_NAME,
  MASTER_DETAIL_TAG,
} from '../utils/metadataConstants'
import { join, parse, resolve } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'

const readFileSyncOptions = {
  encoding: UTF8_ENCODING,
}

export default class CustomObjectHandler extends StandardHandler {
  override handleAddition(): void {
    super.handleAddition()
    if (!this.config.generateDelta) return
    this._handleMasterDetailException()
  }

  private _handleMasterDetailException(): void {
    if (this.type !== CustomObjectHandler.OBJECT_TYPE) return

    const fieldsFolder = resolve(
      this.config.repo,
      join(parse(this.line).dir, FIELD_DIRECTORY_NAME)
    )
    if (!existsSync(fieldsFolder)) return

    readdirSync(fieldsFolder)
      .filter((fieldPath: string): boolean =>
        readFileSync(
          resolve(this.config.repo, fieldsFolder, fieldPath),
          readFileSyncOptions
        ).includes(MASTER_DETAIL_TAG)
      )
      .forEach((field: string): void =>
        this.copyFiles(
          resolve(this.config.repo, fieldsFolder, field),
          resolve(this.config.output, fieldsFolder, field)
        )
      )
  }

  static OBJECT_TYPE: string = 'objects'
}
