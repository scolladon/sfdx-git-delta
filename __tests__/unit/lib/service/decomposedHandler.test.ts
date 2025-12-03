'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import DecomposedHandler from '../../../../src/service/decomposedHandler'
import type { Work } from '../../../../src/types/work'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const recordTypeType = {
  directoryName: 'recordTypes',
  inFolder: false,
  metaFile: false,
  suffix: 'recordType',
  xmlName: 'RecordType',
}
const line =
  'A       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml'

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getGlobalMetadata()
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
  work.config.generateDelta = false
})

describe('DecomposedHandler', () => {
  describe.each([
    'handleAddition',
    'handleDeletion',
    'handleModification',
  ])('in %s case', method => {
    it('element name should have the parent metadata', async () => {
      // Arrange
      const sut = new DecomposedHandler(
        line,
        recordTypeType,
        work,
        globalMetadata
      )
      const expectSubject =
        method === 'handleDeletion'
          ? work.diffs.destructiveChanges
          : work.diffs.package

      // Act
      await sut[method as keyof DecomposedHandler]()

      // Assert
      expect(expectSubject.get('RecordType')).toContain('Account.Test')
    })
  })
})
