type MetadataElement = {
  childXmlNames?: string | Array<string>
  directoryName: string
  inFolder: boolean
  metaFile: boolean
  suffix?: string
  xmlName: string
  xmlTag?: string
}

type MetadataRepository = {
  [key: string]: MetadataElement
}

export type { MetadataRepository, MetadataElement }
