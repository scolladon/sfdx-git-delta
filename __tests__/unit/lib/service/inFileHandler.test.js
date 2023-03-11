'use strict'
const InFile = require('../../../../src/service/inFileHandler')
const { writeFile } = require('../../../../src/utils/fsHelper')

const mockCompare = jest.fn()
const mockpruneContent = jest.fn()
jest.mock('../../../../src/utils/fileGitDiff', () => {
  return jest.fn().mockImplementation(() => {
    return { compare: mockCompare, pruneContent: mockpruneContent }
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
      mockCompare.mockReturnValue({
        added: new Map([['workflows.alerts', new Set(['test'])]]),
        deleted: new Map(),
      })
    })
    it('should store the added metadata in the package', async () => {
      // Act
      await sut.handleAddition()

      // Assert
      expect(work.diffs.destructiveChanges.size).toEqual(0)
      expect(work.diffs.package.get('workflows')).toEqual(new Set(['Account']))
      expect(work.diffs.package.get('workflows.alerts')).toEqual(
        new Set(['Account.test'])
      )

      if (generateDelta) {
        expect(mockpruneContent).toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalled()
      } else {
        expect(mockpruneContent).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
      }
    })
  })

  describe('when file is modified', () => {
    let sut
    beforeEach(() => {
      // Arrange
      sut = new InFile(
        'force-app/main/default/workflows/Test/Account.workflow-meta.xml',
        'workflows',
        work,
        globalMetadata
      )
      mockCompare.mockReturnValue({
        added: new Map([['workflows.alerts', new Set(['test'])]]),
        deleted: new Map([['workflows.alerts', new Set(['deleted'])]]),
      })
    })
    it('should store the added metadata in the package and deleted in the destructiveChanges', async () => {
      // Act
      await sut.handleModification()

      // Assert
      expect(work.diffs.package.get('workflows')).toEqual(new Set(['Account']))
      expect(work.diffs.package.get('workflows.alerts')).toEqual(
        new Set(['Account.test'])
      )
      expect(work.diffs.destructiveChanges.get('workflows.alerts')).toEqual(
        new Set(['Account.deleted'])
      )
      expect(work.diffs.destructiveChanges.has('workflows')).toBe(false)
      if (generateDelta) {
        expect(mockpruneContent).toHaveBeenCalled()
        expect(writeFile).toHaveBeenCalled()
      } else {
        expect(mockpruneContent).not.toHaveBeenCalled()
        expect(writeFile).not.toHaveBeenCalled()
      }
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
      mockCompare.mockReturnValue({
        added: new Map(),
        deleted: new Map([['workflows.alerts', new Set(['test'])]]),
      })
    })
    it('should store the deleted metadata in the destructiveChanges', async () => {
      // Act
      await sut.handleDeletion()

      // Assert
      expect(work.diffs.package.size).toEqual(0)
      expect(work.diffs.destructiveChanges.has('workflows')).toBe(false)
      expect(work.diffs.destructiveChanges.get('workflows.alerts')).toEqual(
        new Set(['Account.test'])
      )
      expect(mockpruneContent).not.toHaveBeenCalled()
      expect(writeFile).not.toHaveBeenCalled()
    })
  })
})
