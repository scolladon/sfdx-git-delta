'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InFileHandler from '../../../../src/service/inFileHandler'
import type { Work } from '../../../../src/types/work'
import { writeFile } from '../../../../src/utils/fsHelper'
import { getWork } from '../../../__utils__/testWork'

const mockCompare = jest.fn()
const mockPrune = jest.fn()
jest.mock('../../../../src/utils/metadataDiff', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return { compare: mockCompare, prune: mockPrune }
    }),
  }
})
jest.mock('../../../../src/utils/fsHelper')

const workflowType = {
  childXmlNames: [
    'WorkflowFieldUpdate',
    'WorkflowFlowAction',
    'WorkflowKnowledgePublish',
    'WorkflowTask',
    'WorkflowAlert',
    'WorkflowSend',
    'WorkflowOutboundMessage',
    'WorkflowRule',
  ],
  directoryName: 'workflows',
  inFolder: false,
  metaFile: false,
  suffix: 'workflow',
  xmlName: 'Workflow',
}
const globalValueSetTranslationsType = {
  directoryName: 'globalValueSetTranslations',
  inFolder: false,
  metaFile: false,
  suffix: 'globalValueSetTranslation',
  xmlName: 'GlobalValueSetTranslation',
  pruneOnly: true,
}

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})
let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()

  mockPrune.mockReturnValue({ xmlContent: '<xmlContent>', isEmpty: false })
})
describe.each([true, false])(`inFileHandler -d: %s`, generateDelta => {
  beforeEach(() => {
    work.config.generateDelta = generateDelta
  })
  describe('when file is added', () => {
    let sut: InFileHandler
    beforeEach(() => {
      // Arrange
      sut = new InFileHandler(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        workflowType,
        work,
        globalMetadata
      )
      mockCompare.mockImplementation(() =>
        Promise.resolve({
          added: new Map([['WorkflowFlowAction', new Set(['test'])]]),
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
      expect(work.diffs.package.get('WorkflowFlowAction')).toEqual(
        new Set(['Account.test'])
      )

      expect(mockPrune).toHaveBeenCalled()
      if (generateDelta) {
        expect(writeFile).toHaveBeenCalled()
      } else {
        expect(writeFile).not.toHaveBeenCalled()
      }
    })

    describe('when metadata in file is not packable', () => {
      describe('when file have comparable metadata', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFileHandler(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
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

          expect(mockPrune).toHaveBeenCalled()
          if (generateDelta) {
            expect(writeFile).toHaveBeenCalled()
          } else {
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })

      describe('when file does not have comparable metadata but is not empty', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFileHandler(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            work,
            globalMetadata
          )
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: new Map(),
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

          expect(mockPrune).toHaveBeenCalled()
          if (generateDelta) {
            expect(writeFile).toHaveBeenCalled()
          } else {
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })
    })
  })

  describe('when file is modified', () => {
    let sut: InFileHandler

    describe('when element are added and deleted', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFileHandler(
          'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
          workflowType,
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
        expect(mockPrune).toHaveBeenCalled()
        if (generateDelta) {
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(writeFile).not.toHaveBeenCalled()
        }
      })
    })

    describe('when element are deleted and nothing is added', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFileHandler(
          'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
          workflowType,
          work,
          globalMetadata
        )
        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: new Map(),
            deleted: new Map([['WorkflowAlert', new Set(['deleted'])]]),
          })
        )
        mockPrune.mockReturnValue({
          xmlContent: '<xmlContent>',
          isEmpty: true,
        })
      })
      it('should store the deleted in the destructiveChanges and not copy the file', async () => {
        // Act
        await sut.handleModification()

        // Assert
        expect(work.diffs.package.size).toBe(0)
        expect(work.diffs.destructiveChanges.get('WorkflowAlert')).toEqual(
          new Set(['Account.deleted'])
        )
        expect(work.diffs.destructiveChanges.has('Workflow')).toBe(false)
        expect(mockPrune).toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
      })

      describe('when no metadata element are added/deleted and the file does not contains attributes', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFileHandler(
            'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
            workflowType,
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
          expect(mockPrune).toHaveBeenCalled()
          if (generateDelta) {
            expect(writeFile).not.toHaveBeenCalled()
          } else {
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })

      describe('when no metadata element are added, some are deleted but the file contains attributes', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFileHandler(
            'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
            workflowType,
            work,
            globalMetadata
          )
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: new Map(),
              deleted: new Map([['Workflow', new Set(['Deleted'])]]),
            })
          )
          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: true,
          })
        })
        it('should store the added metadata in the package and the file should be copied', async () => {
          // Act
          await sut.handleModification()

          // Assert
          expect(work.diffs.package.size).toEqual(0)
          expect(work.diffs.destructiveChanges.size).toEqual(1)
          expect(work.diffs.destructiveChanges.get('Workflow')).toEqual(
            new Set(['Account.Deleted'])
          )
          expect(mockPrune).toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        })
      })
    })

    describe('when metadata in file is not packable', () => {
      describe('when file have comparable metadata', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFileHandler(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            work,
            globalMetadata
          )
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: new Map([['ValueTranslation', new Set(['Three'])]]),
              deleted: new Map(),
            })
          )
          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: false,
          })
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

          expect(mockPrune).toHaveBeenCalled()
          if (generateDelta) {
            expect(writeFile).toHaveBeenCalled()
          } else {
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })

      describe('when file does not have comparable metadata but is not empty', () => {
        beforeEach(() => {
          // Arrange
          sut = new InFileHandler(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            work,
            globalMetadata
          )
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: new Map(),
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

          expect(mockPrune).toHaveBeenCalled()
          if (generateDelta) {
            expect(writeFile).toHaveBeenCalled()
          } else {
            expect(writeFile).not.toHaveBeenCalled()
          }
        })
      })
    })
  })

  describe('when file is deleted', () => {
    let sut: InFileHandler
    beforeEach(() => {
      // Arrange
      sut = new InFileHandler(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        workflowType,
        work,
        globalMetadata
      )
      mockCompare.mockImplementation(() =>
        Promise.resolve({
          added: new Map(),
          deleted: new Map([['WorkflowAlert', new Set(['test'])]]),
        })
      )
      mockPrune.mockReturnValue({ xmlContent: '<xmlContent>', isEmpty: true })
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
      expect(mockPrune).toHaveBeenCalled()
      expect(writeFile).not.toHaveBeenCalled()
    })
    describe('when metadata in file is prune Only', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFileHandler(
          'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
          globalValueSetTranslationsType,
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
