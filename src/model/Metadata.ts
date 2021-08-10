type MetadataElement = {
  childXmlNames?: string | Array<string>
  directoryName: string
  inFolder: boolean
  metaFile: boolean
  suffix?: string
  xmlName: string
  xmlTag?: string
  content?: Array<WaveMetadataType>
}

type WaveMetadataType = {
  suffix: string
  xmlName: string
}

type MetadataRepository = {
  [key: string]: MetadataElement
}

export type { MetadataRepository, MetadataElement, WaveMetadataType }
