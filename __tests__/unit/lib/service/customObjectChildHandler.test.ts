'use strict'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomObjectChildHandler from '../../../../src/service/customObjectChildHandler'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readPathFromGit } from '../../../../src/utils/fsHelper'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

const mockedReadPathFromGit = jest.mocked(readPathFromGit)

const objectType = {
  directoryName: 'recordTypes',
  inFolder: false,
  metaFile: false,
  suffix: 'recordType',
  parentXmlName: 'CustomObject',
  xmlName: 'RecordType',
}
const line =
  'A       force-app/main/default/objects/Account/recordTypes/awesome.recordType-meta.xml'

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('CustomFieldHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('when called with generateDelta false', () => {
    it('should not handle master detail exception', async () => {
      // Arrange
      work.config.generateDelta = false
      const sut = new CustomObjectChildHandler(
        line,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handleAddition()

      // Assert
      expect(copyFiles).not.toHaveBeenCalled()
      expect(work.diffs.package.get('RecordType')).toEqual(
        new Set(['Account.awesome'])
      )
    })
  })
  describe('when called with generateDelta true', () => {
    describe(`when field is not master detail`, () => {
      it('should not handle master detail exception', async () => {
        // Arrange
        mockedReadPathFromGit.mockResolvedValueOnce('')
        const sut = new CustomObjectChildHandler(
          line,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handleAddition()

        // Assert
        expect(copyFiles).toHaveBeenCalledTimes(1)
        expect(work.diffs.package.get('RecordType')).toEqual(
          new Set(['Account.awesome'])
        )
      })
    })
  })
})
