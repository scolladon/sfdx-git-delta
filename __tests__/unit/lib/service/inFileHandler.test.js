'use strict'
const InFile = require('../../../../src/service/inFileHandler')
const { writeFile } = require('../../../../src/utils/fsHelper')

const mockCompare = jest.fn()
const mockprune = jest.fn()
jest.mock('../../../../src/utils/metadataDiff', () => {
  return jest.fn().mockImplementation(() => {
    return { compare: mockCompare, prune: mockprune }
  })
})
jest.mock('../../../../src/utils/fsHelper')

describe.each([true, false])(`inFileHandler`, generateDelta => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  let work
  beforeEach(() => {
    jest.clearAllMocks()
    work = {
      config: {
        output: '',
        source: '',
        repo: '',
        generateDelta,
      },
      diffs: { package: new Map(), destructiveChanges: new Map() },
      warnings: [],
    }
  })

  describe('when file is added', () => {
    let sut
    beforeEach(() => {
      // Arrange
      sut = new InFile(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        'workflows',
        work,
        globalMetadata
      )
      mockCompare.mockResolvedValue({
        added: new Map([['WorkflowAlert', new Set(['test'])]]),
        deleted: new Map(),
      })
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
        expect(mockprune).toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalled()
      } else {
        expect(mockprune).not.toHaveBeenCalled()
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
        mockCompare.mockResolvedValue({
          added: new Map([['ValueTranslation', new Set(['Three'])]]),
          deleted: new Map(),
        })
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
          expect(mockprune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockprune).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        }
      })
    })
  })

  describe('when file is modified', () => {
    let sut

    describe('when element are added and deleted', () => {
      beforeEach(() => {
        // Arrange
        sut = new InFile(
          'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
          'workflows',
          work,
          globalMetadata
        )
        mockCompare.mockResolvedValue({
          added: new Map([['WorkflowAlert', new Set(['test'])]]),
          deleted: new Map([['WorkflowAlert', new Set(['deleted'])]]),
        })
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
          expect(mockprune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockprune).not.toHaveBeenCalled()
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
        mockCompare.mockResolvedValue({
          added: new Map(),
          deleted: new Map([['WorkflowAlert', new Set(['deleted'])]]),
        })
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
        expect(mockprune).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
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
        mockCompare.mockResolvedValue({
          added: new Map([['ValueTranslation', new Set(['Three'])]]),
          deleted: new Map(),
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

        if (generateDelta) {
          expect(mockprune).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalled()
        } else {
          expect(mockprune).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        }
      })
    })
  })

  describe('when file is deleted', () => {
    let sut
    beforeEach(() => {
      // Arrange
      sut = new InFile(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        'workflows',
        work,
        globalMetadata
      )
      mockCompare.mockResolvedValue({
        added: new Map(),
        deleted: new Map([['WorkflowAlert', new Set(['test'])]]),
      })
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
      expect(mockprune).not.toHaveBeenCalled()
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
        expect(mockprune).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
      })
    })
  })
})
