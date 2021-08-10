import StandardHandler from './standardHandler'
import {
  MASTER_DETAIL_TAG,
  OBJECT_META_XML_SUFFIX,
} from '../utils/metadataConstants'
import { join, sep } from 'path'
import { Package } from '../model/Package'

export default class SubCustomObjectHandler extends StandardHandler {
  override handleDeletion(): void {
    this.fillPackage(this.diffs.destructiveChanges)
  }

  override handleAddition(): void {
    super.handleAddition()
    if (!this.config.generateDelta) return

    const data = this.readFileSync()
    if (data?.includes(MASTER_DETAIL_TAG)) {
      const customObjectDirPath = this.splittedLine
        .slice(0, this.splittedLine.indexOf(this.type))
        .join(sep)
      const customObjectName = this.splittedLine[
        this.splittedLine.indexOf(this.type) - 1
      ]

      const customObjectPath = join(
        customObjectDirPath,
        `${customObjectName}.${OBJECT_META_XML_SUFFIX}`
      )

      this.copyFiles(
        join(this.config.repo, customObjectPath),
        join(this.config.output, customObjectPath)
      )
    }
  }

  override fillPackage(packageObject: Package): void {
    packageObject[this.type] = packageObject[this.type] ?? new Set()
    const prefix = this.splittedLine[this.splittedLine.indexOf(this.type) - 1]

    const elementName = this.getElementName()

    packageObject[this.type].add(`${prefix}.${elementName}`)
  }
}
