'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import InFile from '../../../../src/service/inFileHandler'
import { writeFile } from '../../../../src/utils/fsHelper'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/types/metadata'
import InFileHandler from '../../../../src/service/inFileHandler'

const mockCompare = jest.fn()
const mockPrune = jest.fn()
jest.mock('../../../../src/utils/metadataDiff', () => {
  return jest.fn().mockImplementation(() => {
    return { compare: mockCompare, prune: mockPrune }
  })
})
jest.mock('../../../../src/utils/fsHelper')

describe.each([true, false])(`inFileHandler -d: %s`, generateDelta => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  let work: Work
  beforeEach(() => {
    jest.clearAllMocks()
    work = getWork()
    work.config.generateDelta = generateDelta
    mockPrune.mockReturnValue({ xmlContent: '<xmlContent>', isEmpty: false })
  })

  describe('when file is added', () => {
    let sut: InFileHandler
    beforeEach(() => {
      // Arrange
      sut = new InFile(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        'workflows',
        work,
        globalMetadata
      )
      mockCompare.mockImplementation(() =>
        Promise.resolve({
          added: new Map([['WorkflowAlert', new Set(['test'])]]),
          deleted: new Map(),
        })
      )
    })
    it('should store the added metadata in the package', async () => {
      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(work.diffs.package.get('Workflow')).toEqual(new Set(['Account']))
      expect(work.diffs.package.get('WorkflowAlert')).toEqual(
        new Set(['Account.test'])
      )

      if (generateDelta) {
        expect(mockPrune).toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalled()
      } else {
        expect(mockPrune).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
      }
    })

    describe('when metadata in file is not packable', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFile(
          'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
          'globalValueSetTranslations',
          work,
          globalMetadata
        )
        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: new Map([['ValueTranslation', new Set(['Three'])]]),
            deleted: new Map(),
          })
        )
      })
      it('should only store file name and not the metadata in file', async () => {
        // Act
        await sut.handleAddition()

        // Assert
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(work.diffs.package.get('GlobalValueSetTranslation')).toEqual(
          new Set(['Numbers-fr'])
        )
        expect(work.diffs.package.size).toEqual(1)

        if (generateDelta) {
          expect(mockPrune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockPrune).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        }
      })
    })
  })

  describe('when file is modified', () => {
    let sut: InFileHandler

    describe('when element are added and deleted', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFile(
          'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
          'workflows',
          work,
          globalMetadata
        )
        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: new Map([['WorkflowAlert', new Set(['test'])]]),
            deleted: new Map([['WorkflowAlert', new Set(['deleted'])]]),
          })
        )
      })
      it('should store the added metadata in the package and deleted in the destructiveChanges', async () => {
        // Act
        await sut.handleModification()

        // Assert
        expect(work.diffs.package.get('Workflow')).toEqual(new Set(['Account']))
        expect(work.diffs.package.get('WorkflowAlert')).toEqual(
          new Set(['Account.test'])
        )
        expect(work.diffs.destructiveChanges.get('WorkflowAlert')).toEqual(
          new Set(['Account.deleted'])
        )
        expect(work.diffs.destructiveChanges.has('Workflow')).toBe(false)
        if (generateDelta) {
          expect(mockPrune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockPrune).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        }
      })
    })

    describe('when element are deleted and nothing is added', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFile(
          'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
          'workflows',
          work,
          globalMetadata
        )
        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: new Map(),
            deleted: new Map([['WorkflowAlert', new Set(['deleted'])]]),
          })
        )
      })
      it('should store the deleted in the destructiveChanges and not copy the file', async () => {
        // Act
        await sut.handleModification()

        // Assert
        expect(work.diffs.package.get('Workflow')).toEqual(new Set(['Account']))
        expect(work.diffs.package.get('WorkflowAlert')).toBeUndefined()
        expect(work.diffs.destructiveChanges.get('WorkflowAlert')).toEqual(
          new Set(['Account.deleted'])
        )
        expect(work.diffs.destructiveChanges.has('Workflow')).toBe(false)
        if (generateDelta) {
          expect(mockPrune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockPrune).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        }
      })

      describe('when no metadata element are added/deleted and the file does not contains attributes', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFile(
            'force-app/main/default/labels/CustomLabel.label-meta.xml',
            'labels',
            work,
            globalMetadata
          )

          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: new Map(),
              deleted: new Map(),
            })
          )

          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: true,
          })
        })
        it('nothing should be stored and the file should not be copied', async () => {
          // Act
          await sut.handleModification()

          // Assert
          expect(work.diffs.package.size).toEqual(0)
          expect(work.diffs.destructiveChanges.size).toEqual(0)
          if (generateDelta) {
            expect(mockPrune).toHaveBeenCalled()
            expect(writeFile).not.toHaveBeenCalled()
          } else {
            expect(mockPrune).not.toHaveBeenCalled()
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })

      describe('when no metadata element are added, some are deleted but the file contains attributes', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFile(
            'force-app/main/default/labels/CustomLabel.label-meta.xml',
            'labels',
            work,
            globalMetadata
          )
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: new Map(),
              deleted: new Map([['CustomLabel', new Set(['Deleted'])]]),
            })
          )
          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: false,
          })
        })
        it('should store the added metadata in the package and the file should be copied', async () => {
          // Act
          await sut.handleModification()

          // Assert
          expect(work.diffs.package.size).toEqual(0)
          expect(work.diffs.destructiveChanges.size).toEqual(1)
          expect(work.diffs.destructiveChanges.get('CustomLabel')).toEqual(
            new Set(['Deleted'])
          )
          if (generateDelta) {
            expect(mockPrune).toHaveBeenCalled()
            expect(writeFile).toHaveBeenCalled()
          } else {
            expect(mockPrune).not.toHaveBeenCalled()
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })
    })

    describe('when metadata in file is not packable', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFile(
          'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
          'globalValueSetTranslations',
          work,
          globalMetadata
        )

        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: new Map([['ValueTranslation', new Set(['Three'])]]),
            deleted: new Map(),
          })
        )
      })
      it('should only store file name and not the metadata in file', async () => {
        // Act
        await sut.handleModification()

        // Assert
        expect(work.diffs.destructiveChanges.size).toEqual(0)
        expect(work.diffs.package.get('GlobalValueSetTranslation')).toEqual(
          new Set(['Numbers-fr'])
        )
        expect(work.diffs.package.size).toEqual(1)

        if (generateDelta) {
          expect(mockPrune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockPrune).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        }
      })
    })
  })

  describe('when file is deleted', () => {
    let sut: InFileHandler
    beforeEach(() => {
      // Arrange
      sut = new InFile(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        'workflows',
        work,
        globalMetadata
      )
      mockCompare.mockImplementation(() =>
        Promise.resolve({
          added: new Map(),
          deleted: new Map([['WorkflowAlert', new Set(['test'])]]),
        })
      )
    })
    it('should store the deleted metadata in the destructiveChanges', async () => {
      // Act
      await sut.handleDeletion()

      // Assert
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.has('Workflow')).toBe(false)
      expect(work.diffs.destructiveChanges.get('WorkflowAlert')).toEqual(
        new Set(['Account.test'])
      )
      expect(mockCompare).toHaveBeenCalled()
      expect(mockPrune).not.toHaveBeenCalled()
      expect(writeFile).not.toHaveBeenCalled()
    })
    describe('when metadata in file is prune Only', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFile(
          'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
          'globalValueSetTranslations',
          work,
          globalMetadata
        )
      })
      it('should only store file name and not the metadata in file', async () => {
        // Act
        await sut.handleDeletion()

        // Assert
        expect(work.diffs.package.size).toEqual(0)
        expect(work.diffs.destructiveChanges.has('ValueTranslation')).toBe(
          false
        )
        expect(
          work.diffs.destructiveChanges.get('GlobalValueSetTranslation')
        ).toEqual(new Set(['Numbers-fr']))
        expect(mockCompare).not.toHaveBeenCalled()
        expect(mockPrune).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
      })
    })
  })
})
