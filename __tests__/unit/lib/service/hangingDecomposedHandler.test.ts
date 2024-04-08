'use strict'
import { expect, jest, describe, it } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import HangingDecomposedHandler from '../../../../src/service/hangingDecomposedHandler'
import type { Work } from '../../../../src/types/work'
import { pathExists } from '../../../../src/utils/fsHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('../../../../src/utils/fsHelper')

const mockedPathExists = jest.mocked(pathExists)

const testCases = [
  [
    'force-app/main/default/permissionsets/SalesRep/applicationVisibilities/Sales_app.applicationVisibility-meta.xml',
    'SalesRep',
  ],
  [
    'force-app/main/default/permissionsets/SalesRep.permissionset-meta.xml',
    'SalesRep',
  ],
  [
    'force-app/main/default/permissionsets/folder/CustomerSupport/objectPermissions/Case.objectPermission-meta.xml',
    'CustomerSupport',
  ],
  [
    'force-app/main/default/permissionsets/folder/CustomerSupport.permissionset-meta.xml',
    'CustomerSupport',
  ],
]
const type = {
  directoryName: 'permissionsets',
  inFolder: false,
  metaFile: false,
  suffix: 'permissionset',
  xmlName: 'PermissionSet',
}
let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('HangingDecomposedHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  describe('when the file is splitted', () => {
    describe('when new file is added', () => {
      it.each(testCases)(
        'for line %s, parent permission set %s should be packaged',
        async (line, expected) => {
          // Arrange
          const sut = new HangingDecomposedHandler(
            line,
            type,
            work,
            globalMetadata
          )

          // Act
          await sut.handleAddition()

          // Assert
          expect(work.diffs.package.get(type.xmlName)).toContain(expected)
        }
      )
    })

    describe('when existing file is modified', () => {
      it.each(testCases)(
        'for line %s, parent permission set %s should be packaged',
        async (line, expected) => {
          // Arrange
          const sut = new HangingDecomposedHandler(
            line,
            type,
            work,
            globalMetadata
          )

          // Act
          await sut.handleModification()

          // Assert
          expect(work.diffs.package.get(type.xmlName)).toContain(expected)
        }
      )
    })

    describe('when existing file is deleted', () => {
      describe('when there is no other file', () => {
        beforeEach(() => {
          mockedPathExists.mockResolvedValue(false)
        })
        it.each(testCases)(
          'for deleted line %s, parent permission set %s should be in the destructiveChange',
          async (line, expected) => {
            // Arrange
            const sut = new HangingDecomposedHandler(
              line,
              type,
              work,
              globalMetadata
            )

            // Act
            await sut.handleDeletion()

            // Assert
            expect(work.diffs.destructiveChanges.get(type.xmlName)).toContain(
              expected
            )
            expect(pathExists).toHaveBeenCalledWith(
              expect.stringContaining(expected),
              work.config
            )
          }
        )
      })

      describe('when there are other files', () => {
        beforeEach(() => {
          mockedPathExists.mockResolvedValue(true)
        })
        it.each(testCases)(
          'for deleted line %s, parent permission set %s should be packaged',
          async (line, expected) => {
            // Arrange
            const sut = new HangingDecomposedHandler(
              line,
              type,
              work,
              globalMetadata
            )

            // Act
            await sut.handleDeletion()

            // Assert
            expect(work.diffs.package.get(type.xmlName)).toContain(expected)
            expect(pathExists).toHaveBeenCalledWith(
              expect.stringContaining(expected),
              work.config
            )
          }
        )
      })
    })
  })
})
