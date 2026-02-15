'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InFileHandler from '../../../../src/service/inFileHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
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

describe('inFileHandler', () => {
  describe('when file is added', () => {
    let sut: InFileHandler
    beforeEach(() => {
      // Arrange
      const { changeType, element } = createElement(
        'force-app/main/default/workflows/Account.workflow-meta.xml',
        workflowType,
        globalMetadata
      )
      sut = new InFileHandler(changeType, element, work)
      mockCompare.mockImplementation(() =>
        Promise.resolve({
          added: [{ type: 'WorkflowFlowAction', member: 'test' }],
          deleted: [],
        })
      )
    })
    it('should store the added metadata in the package', async () => {
      // Act
      const result = await sut.collectAddition()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'Workflow',
            member: 'Account',
          }),
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'WorkflowFlowAction',
            member: 'Account.test',
          }),
        ])
      )
      expect(
        result.manifests.some(
          m => m.target === ManifestTarget.DestructiveChanges
        )
      ).toBe(false)
      expect(mockPrune).toHaveBeenCalled()
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.ComputedContent)
      ).toBe(true)
    })

    describe('when metadata in file is not packable', () => {
      describe('when file have comparable metadata', () => {
        beforeEach(() => {
          // Arrange
          const { changeType, element } = createElement(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            globalMetadata
          )
          sut = new InFileHandler(changeType, element, work)
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: [{ type: 'ValueTranslation', member: 'Three' }],
              deleted: [],
            })
          )
        })
        it('should only store file name and not the metadata in file', async () => {
          // Act
          const result = await sut.collectAddition()

          // Assert
          expect(
            result.manifests.some(
              m => m.target === ManifestTarget.DestructiveChanges
            )
          ).toBe(false)
          expect(result.manifests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: 'GlobalValueSetTranslation',
                member: 'Numbers-fr',
              }),
            ])
          )
          const packageManifests = result.manifests.filter(
            m => m.target === ManifestTarget.Package
          )
          expect(packageManifests).toHaveLength(1)
          expect(mockPrune).toHaveBeenCalled()
          expect(
            result.copies.some(
              c => c.kind === CopyOperationKind.ComputedContent
            )
          ).toBe(true)
        })
      })

      describe('when file does not have comparable metadata but is not empty', () => {
        beforeEach(() => {
          // Arrange
          const { changeType, element } = createElement(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            globalMetadata
          )
          sut = new InFileHandler(changeType, element, work)
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: [],
              deleted: [],
            })
          )
        })
        it('should only store file name and not the metadata in file', async () => {
          // Act
          const result = await sut.collectAddition()

          // Assert
          expect(
            result.manifests.some(
              m => m.target === ManifestTarget.DestructiveChanges
            )
          ).toBe(false)
          expect(result.manifests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: 'GlobalValueSetTranslation',
                member: 'Numbers-fr',
              }),
            ])
          )
          const packageManifests = result.manifests.filter(
            m => m.target === ManifestTarget.Package
          )
          expect(packageManifests).toHaveLength(1)
          expect(mockPrune).toHaveBeenCalled()
          expect(
            result.copies.some(
              c => c.kind === CopyOperationKind.ComputedContent
            )
          ).toBe(true)
        })
      })
    })
  })

  describe('when file is modified', () => {
    let sut: InFileHandler

    describe('when elements are added and deleted', () => {
      beforeEach(() => {
        // Arrange
        const { changeType, element } = createElement(
          'force-app/main/default/workflows/Account.workflow-meta.xml',
          workflowType,
          globalMetadata
        )
        sut = new InFileHandler(changeType, element, work)
        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: [{ type: 'WorkflowAlert', member: 'test' }],
            deleted: [{ type: 'WorkflowAlert', member: 'deleted' }],
          })
        )
      })
      it('should store the added metadata in the package and deleted in the destructiveChanges', async () => {
        // Act
        const result = await sut.collectModification()

        // Assert
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'Workflow',
              member: 'Account',
            }),
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: 'WorkflowAlert',
              member: 'Account.test',
            }),
            expect.objectContaining({
              target: ManifestTarget.DestructiveChanges,
              type: 'WorkflowAlert',
              member: 'Account.deleted',
            }),
          ])
        )
        expect(
          result.manifests.some(
            m =>
              m.target === ManifestTarget.DestructiveChanges &&
              m.type === 'Workflow'
          )
        ).toBe(false)
        expect(mockPrune).toHaveBeenCalled()
        expect(
          result.copies.some(c => c.kind === CopyOperationKind.ComputedContent)
        ).toBe(true)
      })
    })

    describe('when elements are deleted and nothing is added', () => {
      beforeEach(() => {
        // Arrange
        const { changeType, element } = createElement(
          'force-app/main/default/workflows/Account.workflow-meta.xml',
          workflowType,
          globalMetadata
        )
        sut = new InFileHandler(changeType, element, work)
        mockCompare.mockImplementation(() =>
          Promise.resolve({
            added: [],
            deleted: [{ type: 'WorkflowAlert', member: 'deleted' }],
          })
        )
        mockPrune.mockReturnValue({
          xmlContent: '<xmlContent>',
          isEmpty: true,
        })
      })
      it('should store the deleted in the destructiveChanges and not produce a copy', async () => {
        // Act
        const result = await sut.collectModification()

        // Assert
        const packageManifests = result.manifests.filter(
          m => m.target === ManifestTarget.Package
        )
        expect(packageManifests).toHaveLength(0)
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.DestructiveChanges,
              type: 'WorkflowAlert',
              member: 'Account.deleted',
            }),
          ])
        )
        expect(
          result.manifests.some(
            m =>
              m.target === ManifestTarget.DestructiveChanges &&
              m.type === 'Workflow'
          )
        ).toBe(false)
        expect(mockPrune).toHaveBeenCalled()
        expect(
          result.copies.some(c => c.kind === CopyOperationKind.ComputedContent)
        ).toBe(false)
      })

      describe('when no metadata elements are added/deleted and the file does not contain attributes', () => {
        beforeEach(() => {
          // Arrange
          const { changeType, element } = createElement(
            'force-app/main/default/workflows/Account.workflow-meta.xml',
            workflowType,
            globalMetadata
          )
          sut = new InFileHandler(changeType, element, work)

          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: [],
              deleted: [],
            })
          )

          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: true,
          })
        })
        it('nothing should be stored and no copy should be produced', async () => {
          // Act
          const result = await sut.collectModification()

          // Assert
          expect(result.manifests).toHaveLength(0)
          expect(result.copies).toHaveLength(0)
          expect(mockPrune).toHaveBeenCalled()
        })
      })

      describe('when no metadata elements are added, some are deleted but the file contains attributes', () => {
        beforeEach(() => {
          // Arrange
          const { changeType, element } = createElement(
            'force-app/main/default/workflows/Account.workflow-meta.xml',
            workflowType,
            globalMetadata
          )
          sut = new InFileHandler(changeType, element, work)
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: [],
              deleted: [{ type: 'Workflow', member: 'Deleted' }],
            })
          )
          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: true,
          })
        })
        it('should store the deleted metadata in destructiveChanges and not produce a copy', async () => {
          // Act
          const result = await sut.collectModification()

          // Assert
          const packageManifests = result.manifests.filter(
            m => m.target === ManifestTarget.Package
          )
          expect(packageManifests).toHaveLength(0)
          expect(result.manifests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.DestructiveChanges,
                type: 'Workflow',
                member: 'Account.Deleted',
              }),
            ])
          )
          expect(mockPrune).toHaveBeenCalled()
          expect(
            result.copies.some(
              c => c.kind === CopyOperationKind.ComputedContent
            )
          ).toBe(false)
        })
      })
    })

    describe('when metadata in file is not packable', () => {
      describe('when file have comparable metadata', () => {
        beforeEach(() => {
          // Arrange
          const { changeType, element } = createElement(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            globalMetadata
          )
          sut = new InFileHandler(changeType, element, work)
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: [{ type: 'ValueTranslation', member: 'Three' }],
              deleted: [],
            })
          )
          mockPrune.mockReturnValue({
            xmlContent: '<xmlContent>',
            isEmpty: false,
          })
        })
        it('should only store file name and not the metadata in file', async () => {
          // Act
          const result = await sut.collectModification()

          // Assert
          expect(
            result.manifests.some(
              m => m.target === ManifestTarget.DestructiveChanges
            )
          ).toBe(false)
          expect(result.manifests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: 'GlobalValueSetTranslation',
                member: 'Numbers-fr',
              }),
            ])
          )
          const packageManifests = result.manifests.filter(
            m => m.target === ManifestTarget.Package
          )
          expect(packageManifests).toHaveLength(1)
          expect(mockPrune).toHaveBeenCalled()
          expect(
            result.copies.some(
              c => c.kind === CopyOperationKind.ComputedContent
            )
          ).toBe(true)
        })
      })

      describe('when file does not have comparable metadata but is not empty', () => {
        beforeEach(() => {
          // Arrange
          const { changeType, element } = createElement(
            'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
            globalValueSetTranslationsType,
            globalMetadata
          )
          sut = new InFileHandler(changeType, element, work)
          mockCompare.mockImplementation(() =>
            Promise.resolve({
              added: [],
              deleted: [],
            })
          )
        })
        it('should only store file name and not the metadata in file', async () => {
          // Act
          const result = await sut.collectModification()

          // Assert
          expect(
            result.manifests.some(
              m => m.target === ManifestTarget.DestructiveChanges
            )
          ).toBe(false)
          expect(result.manifests).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: 'GlobalValueSetTranslation',
                member: 'Numbers-fr',
              }),
            ])
          )
          const packageManifests = result.manifests.filter(
            m => m.target === ManifestTarget.Package
          )
          expect(packageManifests).toHaveLength(1)
          expect(mockPrune).toHaveBeenCalled()
          expect(
            result.copies.some(
              c => c.kind === CopyOperationKind.ComputedContent
            )
          ).toBe(true)
        })
      })
    })
  })

  describe('when file is deleted', () => {
    let sut: InFileHandler
    beforeEach(() => {
      // Arrange
      const { changeType, element } = createElement(
        'force-app/main/default/workflows/Account.workflow-meta.xml',
        workflowType,
        globalMetadata
      )
      sut = new InFileHandler(changeType, element, work)
      mockCompare.mockImplementation(() =>
        Promise.resolve({
          added: [],
          deleted: [{ type: 'WorkflowAlert', member: 'test' }],
        })
      )
      mockPrune.mockReturnValue({ xmlContent: '<xmlContent>', isEmpty: true })
    })
    it('should store the deleted metadata in the destructiveChanges', async () => {
      // Act
      const result = await sut.collectDeletion()

      // Assert
      const packageManifests = result.manifests.filter(
        m => m.target === ManifestTarget.Package
      )
      expect(packageManifests).toHaveLength(0)
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'WorkflowAlert',
            member: 'Account.test',
          }),
        ])
      )
      expect(
        result.manifests.some(
          m =>
            m.target === ManifestTarget.DestructiveChanges &&
            m.type === 'Workflow'
        )
      ).toBe(false)
      expect(mockCompare).toHaveBeenCalled()
      expect(mockPrune).toHaveBeenCalled()
      expect(
        result.copies.some(c => c.kind === CopyOperationKind.ComputedContent)
      ).toBe(false)
    })
    describe('when metadata in file is prune Only', () => {
      beforeEach(() => {
        // Arrange
        const { changeType, element } = createElement(
          'force-app/main/default/globalValueSetTranslations/Numbers-fr.globalValueSetTranslation-meta.xml',
          globalValueSetTranslationsType,
          globalMetadata
        )
        sut = new InFileHandler(changeType, element, work)
      })
      it('should only store file name and not the metadata in file', async () => {
        // Act
        const result = await sut.collectDeletion()

        // Assert
        const packageManifests = result.manifests.filter(
          m => m.target === ManifestTarget.Package
        )
        expect(packageManifests).toHaveLength(0)
        expect(result.manifests).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.DestructiveChanges,
              type: 'GlobalValueSetTranslation',
              member: 'Numbers-fr',
            }),
          ])
        )
        expect(result.manifests.some(m => m.type === 'ValueTranslation')).toBe(
          false
        )
        expect(mockCompare).not.toHaveBeenCalled()
        expect(mockPrune).not.toHaveBeenCalled()
        expect(result.copies).toHaveLength(0)
      })
    })
  })
})

describe('inFileHandler collect', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  let work: Work
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

  beforeEach(() => {
    jest.clearAllMocks()
    work = getWork()
    mockPrune.mockReturnValue({ xmlContent: '<xmlContent>', isEmpty: false })
  })

  it('Given added workflow with child elements, When collect, Then returns Package manifests and ComputedContent copy', async () => {
    // Arrange
    const { changeType, element } = createElement(
      'A       force-app/main/default/workflows/Account.workflow-meta.xml',
      workflowType,
      globalMetadata
    )
    const sut = new InFileHandler(changeType, element, work)
    mockCompare.mockImplementation(() =>
      Promise.resolve({
        added: [{ type: 'WorkflowFlowAction', member: 'test' }],
        deleted: [],
      })
    )

    // Act
    const result = await sut.collect()

    // Assert
    expect(result.manifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: ManifestTarget.Package,
          type: 'Workflow',
          member: 'Account',
        }),
        expect.objectContaining({
          target: ManifestTarget.Package,
          type: 'WorkflowFlowAction',
          member: 'Account.test',
        }),
      ])
    )
    expect(
      result.copies.some(c => c.kind === CopyOperationKind.ComputedContent)
    ).toBe(true)
    expect(result.warnings).toHaveLength(0)
  })

  it('Given modified workflow with added and deleted elements, When collect, Then returns both Package and DestructiveChanges manifests', async () => {
    // Arrange
    const { changeType, element } = createElement(
      'M       force-app/main/default/workflows/Account.workflow-meta.xml',
      workflowType,
      globalMetadata
    )
    const sut = new InFileHandler(changeType, element, work)
    mockCompare.mockImplementation(() =>
      Promise.resolve({
        added: [{ type: 'WorkflowAlert', member: 'added' }],
        deleted: [{ type: 'WorkflowAlert', member: 'removed' }],
      })
    )

    // Act
    const result = await sut.collect()

    // Assert
    expect(result.manifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          target: ManifestTarget.Package,
          type: 'WorkflowAlert',
          member: 'Account.added',
        }),
        expect.objectContaining({
          target: ManifestTarget.DestructiveChanges,
          type: 'WorkflowAlert',
          member: 'Account.removed',
        }),
      ])
    )
    expect(result.warnings).toHaveLength(0)
  })
})
