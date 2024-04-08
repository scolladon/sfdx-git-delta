'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import InBundleHandler from '../../../../src/service/inBundleHandler'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

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
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe('_getElementName', () => {
    describe('when called with meta file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const sut = new InBundleHandler(line, objectType, work, globalMetadata)

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
        const sut = new InBundleHandler(line, objectType, work, globalMetadata)

        // Act
        const result = sut['_getElementName']()

        // Assert
        expect(result).toEqual('site/component')
      })
    })
  })
})
