'use strict'
import { join } from 'node:path'
import { DOT, PATH_SEP } from '../constant/fsConstants.js'
import { METAFILE_SUFFIX } from '../constant/metadataConstants.js'
import StandardHandler from './standardHandler.js'

import { pathExists, readDir } from '../utils/fsHelper.js'

export default class ContainedDecomposedHandler extends StandardHandler {
  // This type can be either in its directoryName folder or not, into a single file
  // Ex : 'force-app/main/permissionsets/MyCustomPSet.permissionset-meta.xml
  // Ex : 'force-app/main/notpermissionsetfolder/MyCustomPSet.permissionset-meta.xml
  // If the file is added or modified then it is an addition and the element must be added in the package.xml
  // If the file is deleted it is a deletion
  // In this case it works like the standardhandler
  //
  // Or it can be contained into a folder with its content splitted into multiple files (here https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_ws_decomposed_md_types.htm#permset)
  // Ex : 'force-app/main/permissionsets/MyCustomPSet/MyCustomPSet.permissionset-meta.xml
  // Ex : 'force-app/main/permissionsets/MyCustomPSet/MyCustomPSet.userPermissions-meta.xml
  // Ex : 'force-app/main/permissionsets/MyCustomPSet/objectSettings/Account.objectSettings-meta.xml
  // If any file is added or modified then it is an addition, every file should be copied and the parent element should be added in the package.xml
  // If a file is deleted but sub file remain then it is an addition, every file should be copied and the parent element should be added in the package.xml
  // If a file is deleted and the containing folder is deleted as well then it is a deletion and the element should be added in the destructiveChanges.xml

  protected metadataName: string | undefined

  public override async handleAddition() {
    this.metadataName = await this._getMetadataName()
    await super.handleAddition()
    if (!this.config.generateDelta) return

    // For decomposed format, copy all related files
    if (await this._isDecomposedFormat()) {
      await this._copyDecomposedFiles()
    }
  }

  public override async handleDeletion() {
    this.metadataName = await this._getMetadataName()

    // Check if any related files/folders still exist
    const hasRelatedContent = await this._hasRelatedContent()

    if (hasRelatedContent) {
      // If there are still related files, treat as modification
      await this.handleModification()
    } else {
      await super.handleDeletion()
    }
  }

  protected async _getMetadataName() {
    const elementName = this.parsedLine.name
      .replace(METAFILE_SUFFIX, '')
      .split(DOT)[0]

    // Start from the current directory and check parent folders
    for (let i = this.splittedLine.length - 1; i >= 0; i--) {
      // Exit if we've gone past the directoryName
      if (this.splittedLine[i] === this.metadataDef.directoryName) {
        break
      }

      const currentPath = this.splittedLine.slice(0, i).join(PATH_SEP)

      // Check for direct metadata file
      const metadataFile = `${elementName}.${this.metadataDef.suffix}${METAFILE_SUFFIX}`
      const metadataPath = join(currentPath, metadataFile)

      if (await pathExists(metadataPath, this.config)) {
        return join(currentPath, elementName)
      }

      // Check for decomposed format folder
      const folderPath = join(currentPath, elementName)
      if (await pathExists(folderPath, this.config)) {
        const files = await readDir(folderPath, this.config)
        const hasMetadataFile = files.some(file =>
          file.endsWith(`${this.metadataDef.suffix}${METAFILE_SUFFIX}`)
        )

        if (hasMetadataFile) {
          return join(folderPath, elementName)
        }
      }
    }

    return undefined
  }

  protected async _isDecomposedFormat(): Promise<boolean> {
    if (!this.metadataName) return false

    const folderPath = this.metadataName.substring(
      0,
      this.metadataName.lastIndexOf(PATH_SEP)
    )
    return await pathExists(folderPath, this.config)
  }

  protected async _hasRelatedContent(): Promise<boolean> {
    if (!this.metadataName) {
      return false
    }

    const folderPath = this.metadataName.substring(
      0,
      this.metadataName.lastIndexOf(PATH_SEP)
    )

    try {
      // Check if the folder exists and has any content
      const files = await readDir(folderPath, this.config)
      return files.length > 0
    } catch {
      // If folder doesn't exist or can't be read, check for single file
      const metadataFile = `${this.metadataName}.${this.metadataDef.suffix}${METAFILE_SUFFIX}`
      return await pathExists(metadataFile, this.config)
    }
  }

  protected async _copyDecomposedFiles() {
    if (!this.metadataName) return

    const folderPath = this.metadataName.substring(
      0,
      this.metadataName.lastIndexOf(PATH_SEP)
    )

    try {
      // Copy all files in the folder and subfolders
      const files = await readDir(folderPath, this.work.config)
      for (const file of files) {
        await this._copy(file)
      }
    } catch (error) {
      console.error(`Error copying decomposed files: ${error}`)
    }
  }
}
