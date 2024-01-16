'use strict'

export type BaseMetadata = {
  suffix?: string
  xmlName: string
}

export type SharedFolderMetadata = BaseMetadata & {
  content?: BaseMetadata[]
}

export type SharedFileMetadata = BaseMetadata & {
  xmlTag?: string
  key?: string
  excluded?: boolean
  pruneOnly?: boolean
}

export type Metadata = BaseMetadata &
  SharedFolderMetadata &
  SharedFileMetadata & {
    directoryName: string
    inFolder: boolean
    metaFile: boolean
    childXmlNames?: string[]
  }
