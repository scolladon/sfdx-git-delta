import { resolve } from 'path'
import { readdirSync } from 'fs'
import { MetadataRepository, MetadataElement } from '../model/Metadata'

type MetadataMap = {
  [key: string]: string
  latest: string
}

export class MetadataManager {
  private static _apiMap: MetadataMap

  private get apiMap(): MetadataMap {
    if (!MetadataManager._apiMap) {
      MetadataManager._apiMap = readdirSync(__dirname)
        .filter((file: string) => /^[a-z]+\d+\.json$/.test(file))
        .reduce((acc: MetadataMap, file: string) => {
          const matchedVersion = file.match(/\d+/)
          if (matchedVersion !== null) {
            const version = matchedVersion[0]
            acc[version] = file
            acc.latest =
              !acc.latest || acc.latest < version ? version : acc.latest
          }
          return acc
        }, {} as MetadataMap)
      MetadataManager._apiMap.latest =
        MetadataManager._apiMap[MetadataManager._apiMap.latest]
    }
    return MetadataManager._apiMap
  }

  getDefinition(grouping: string, apiVersion: number): {} {
    const apiMap = this.apiMap
    const apiFile =
      !!apiVersion && Object.prototype.hasOwnProperty.call(apiMap, apiVersion)
        ? apiMap[apiVersion]
        : apiMap.latest
    const describeMetadata = require(resolve(__dirname, apiFile))

    return describeMetadata.reduce(
      (metadata: MetadataRepository, element: MetadataElement) => {
        metadata[
          element[grouping as keyof MetadataElement] as keyof MetadataRepository
        ] = element
        return metadata
      },
      {} as MetadataRepository
    )
  }
}
