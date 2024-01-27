'use strict'
import { basename } from 'path'

import { DOT } from '../constant/fsConstants'
import { LABEL_EXTENSION, LABEL_XML_NAME } from '../constant/metadataConstants'
import { MetadataRepository } from '../metadata/MetadataRepository'
import { getInFileAttributes, isPackable } from '../metadata/metadataManager'
import { Manifest, Work } from '../types/work'
import { writeFile } from '../utils/fsHelper'
import MetadataDiff from '../utils/metadataDiff'
import { fillPackageWithParameter } from '../utils/packageHelper'

import StandardHandler from './standardHandler'

const getRootType = (line: string) => basename(line).split(DOT)[0]
const getNamePrefix = ({ subType, line }: { subType: string; line: string }) =>
  subType !== LABEL_XML_NAME ? `${getRootType(line)}.` : ''

export default class InFileHandler extends StandardHandler {
  protected readonly metadataDiff: MetadataDiff
  constructor(
    line: string,
    type: string,
    work: Work,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
    const inFileMetadata = getInFileAttributes(metadata)
    this.metadataDiff = new MetadataDiff(this.config, metadata, inFileMetadata)
  }

  public override async handleAddition() {
    await super.handleAddition()
    await this._compareRevision()

    if (!this.config.generateDelta) return
    await this._writeScopedContent()
  }

  public override async handleDeletion() {
    if (this.metadataDef.pruneOnly) {
      await super.handleDeletion()
    } else {
      await this._compareRevision()
    }
  }

  public override async handleModification() {
    await this.handleAddition()
  }

  protected async _compareRevision() {
    const { added, deleted } = await this.metadataDiff.compare(this.line)
    this._storeComparison(this.diffs.destructiveChanges, deleted)
    this._storeComparison(this.diffs.package, added)
  }

  protected async _writeScopedContent() {
    const { xmlContent, isEmpty } = this.metadataDiff.prune()

    if (!isEmpty) {
      await writeFile(this.line, xmlContent, this.config)
    }
  }

  protected _storeComparison(store: Manifest, content: Manifest) {
    for (const [type, members] of content) {
      for (const member of members) {
        this._fillPackageForInfileMetadata(store, type, member)
      }
    }
  }

  protected _fillPackageForInfileMetadata(
    store: Manifest,
    subType: string,
    member: string
  ) {
    if (isPackable(subType)) {
      const cleanedMember = `${getNamePrefix({
        subType,
        line: this.line,
      })}${member}`

      fillPackageWithParameter({
        store,
        type: subType,
        member: cleanedMember,
      })
    }
  }

  override _delegateFileCopy() {
    return false
  }

  override _fillPackage(store: Manifest) {
    // Call from super.handleAddition to add the Root Type
    // QUESTION: Why InFile element are not deployable when root component is not listed in package.xml ?
    if (this.type !== LABEL_EXTENSION) {
      super._fillPackage(store)
    }
  }
}
