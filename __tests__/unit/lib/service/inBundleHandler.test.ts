'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InBundleHandler from '../../../../src/service/inBundleHandler'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = jest.mocked(readDirs)

const objectType = {
  directoryName: 'digitalExperiences',
  inFolder: false,
  metaFile: true,
  suffix: 'digitalExperience',
  xmlName: 'DigitalExperienceBundle',
}
const entityPath =
  'force-app/main/default/digitalExperiences/site/component.digitalExperience-meta.xml'
const line = `A       ${entityPath}`

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('InBundleHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('_getElementName', () => {
    describe('when called with meta file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const { changeType, element } = createElement(
          line,
          objectType,
          globalMetadata
        )
        const sut = new InBundleHandler(changeType, element, work)

        // Act
        const result = sut['_getElementName']()

        // Assert
        expect(result).toEqual('site/component')
      })
    })

    describe('when called with sub workspace file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const entityPath =
          'force-app/main/default/digitalExperiences/site/component/workspace/file.json'
        const line = `A       ${entityPath}`
        const { changeType, element } = createElement(
          line,
          objectType,
          globalMetadata
        )
        const sut = new InBundleHandler(changeType, element, work)

        // Act
        const result = sut['_getElementName']()

        // Assert
        expect(result).toEqual('site/component')
      })
    })
  })

  describe('collect', () => {
    it('Given meta file addition, When collect, Then returns manifest with correct bundle element name', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new InBundleHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperienceBundle',
            member: 'site/component',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })

    it('Given sub workspace file addition, When collect, Then returns manifest with parent bundle name', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const subLine =
        'A       force-app/main/default/digitalExperiences/site/component/workspace/file.json'
      const { changeType, element } = createElement(
        subLine,
        objectType,
        globalMetadata
      )
      const sut = new InBundleHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperienceBundle',
            member: 'site/component',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })
  })
})
