'use strict'
import { MetadataRepository, WaveMetadataType } from '../model/Metadata'
import { Result } from '../model/Result'
import StandardHandler from './standardHandler'
import { parse } from 'path'
import { Package } from '../model/Package'

type WaveSubType = {
  [key: string]: string
}

const isEmpty = (obj: any): boolean => {
  for (let _ in obj) return false
  return true
}

export default class WaveHandler extends StandardHandler {
  ext: string

  constructor(
    line: string,
    type: string,
    work: Result,
    metadata: MetadataRepository
  ) {
    super(line, type, work, metadata)
    if (isEmpty(WaveHandler._WAVE_SUBTYPE)) {
      StandardHandler.metadata[this.type].content?.reduce(
        (acc: WaveSubType, val: WaveMetadataType) => {
          acc[val.suffix] = val.xmlName
          return acc
        },
        WaveHandler._WAVE_SUBTYPE
      )
    }
    this.ext = parse(this.line).ext.substring(1)
    this.suffixRegex = new RegExp(`\\.${this.ext}$`)
  }

  override fillPackage(packageObject: Package) {
    const type: string = WaveHandler._WAVE_SUBTYPE[this.ext]
    packageObject[type] = packageObject[type] ?? new Set()
    packageObject[type].add(this.getElementName())
  }

  private static _WAVE_SUBTYPE: WaveSubType = {}
}
