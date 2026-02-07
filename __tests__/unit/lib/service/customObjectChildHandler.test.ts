'use strict'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import CustomObjectChildHandler from '../../../../src/service/customObjectChildHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { copyFiles, readPathFromGit } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
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
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectChildHandler(changeType, element, work)

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
        const { changeType, element } = createElement(
          line,
          objectType,
          globalMetadata
        )
        const sut = new CustomObjectChildHandler(changeType, element, work)

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

  describe('collect', () => {
    it('Given record type addition, When collect, Then returns qualified element name in manifest', async () => {
      // Arrange
      const { changeType, element } = createElement(
        line,
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'RecordType',
            member: 'Account.awesome',
          }),
        ])
      )
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.GitCopy)
      ).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given record type deletion, When collect, Then returns qualified name in destructiveChanges', async () => {
      // Arrange
      const { changeType, element } = createElement(
        'D       force-app/main/default/objects/Account/recordTypes/awesome.recordType-meta.xml',
        objectType,
        globalMetadata
      )
      const sut = new CustomObjectChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'RecordType',
            member: 'Account.awesome',
          }),
        ])
      )
      expect(result.copies).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })
  })
})
