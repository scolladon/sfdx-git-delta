'use strict'
const InFile = require('../../../../src/service/inFileHandler')
const {
  ADDITION,
  MODIFICATION,
  DELETION,
  PLUS,
  MINUS,
} = require('../../../../src/utils/gitConstants')
const fileGitDiff = require('../../../../src/utils/fileGitDiff')
const { readFileFromGit, copyFiles } = require('../../../../src/utils/fsHelper')
const { EOL } = require('os')
const { outputFile } = require('fs-extra')

jest.unmock('fast-xml-parser')
jest.mock('fs-extra')
jest.mock('../../../../src/utils/fileGitDiff')
jest.mock('../../../../src/utils/fsHelper')

let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', source: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
    warnings: [],
  }
})

describe(`inFileHandler`, () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })

  describe.each([
    ['added', ADDITION],
    ['modified', MODIFICATION],
  ])('When entity is %s', (_, changeType) => {
    describe('with syntactically correct xml', () => {
      it('should it populate package.xml and copy file', async () => {
        // Arrange
        const line =
          'force-app/main/default/workflows/Test/Account.workflow-meta.xml'
        const goodXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${EOL}<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<alerts>${EOL}<fullName>TestEA</fullName>${EOL}</alerts>${EOL}<fieldUpdates>${EOL}<fullName>TestFU</fullName>${EOL}</fieldUpdates>${EOL}<rules>${EOL}<fullName>TestRule</fullName>${EOL}</rules>${EOL}${EOL}</Workflow>`
        fileGitDiff.mockImplementation(() =>
          goodXml.split(EOL).map(x => `${PLUS} ${x}`)
        )
        readFileFromGit.mockImplementation(() => goodXml)
        const sut = new InFile(
          `${changeType}       ${line}`,
          'workflows',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package).toEqual(
          new Map([
            ['workflows', new Set(['Account'])],
            ['workflows.alerts', new Set(['Account.TestEA'])],
            ['workflows.fieldUpdates', new Set(['Account.TestFU'])],
            ['workflows.rules', new Set(['Account.TestRule'])],
          ])
        )
        expect(work.warnings).toHaveLength(0)
        expect(copyFiles).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          line,
          expect.stringContaining('TestEA')
        )
        expect(outputFile).toHaveBeenCalledWith(
          line,
          expect.stringContaining('TestFU')
        )
        expect(outputFile).toHaveBeenCalledWith(
          line,
          expect.stringContaining('TestRule')
        )
      })
    })

    describe('with syntactically incorrect xml', () => {
      it('should parse modification properly and generate wrong xml file', async () => {
        // Arrange
        const line = 'force-app/main/error/labels/CustomLabels.labels-meta.xml'
        const badXml = `<?xml version="1.0" encoding="UTF-8"?>${EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<labels>${EOL}<fullName>TestLabel1</fullName>${EOL}</labels>${EOL}</labels>${EOL}<labels>${EOL}<fullName>TestLabel2</fullName>${EOL}<!--/labels-->${EOL}</CustomLabels>`
        fileGitDiff.mockImplementation(() =>
          badXml.split(EOL).map(x => `${PLUS} ${x}`)
        )
        readFileFromGit.mockImplementation(() => badXml)
        const sut = new InFile(
          `${changeType}       ${line}`,
          'labels',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package).toEqual(
          new Map([['labels.labels', new Set(['TestLabel1', 'TestLabel2'])]])
        )
        expect(work.warnings).toHaveLength(0)
        expect(copyFiles).toBeCalledTimes(1)
        expect(outputFile).toHaveBeenCalledWith(
          line,
          expect.stringMatching(/<\/labels>\n$/)
        )
      })
    })

    describe('when not generating delta', () => {
      beforeEach(() => {
        work.config.generateDelta = false
      })

      it('should generate manifest without copying files', async () => {
        // Arrange
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>${EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<labels>${EOL}<fullName>Label1</fullName>${EOL}</labels>${EOL}</labels>${EOL}</CustomLabels>`
        fileGitDiff.mockImplementation(() =>
          xmlContent.split(EOL).map(x => `${PLUS} ${x}`)
        )
        readFileFromGit.mockImplementation(() => xmlContent)
        const sut = new InFile(
          `${changeType}       force-app/main/error/labels/CustomLabels.labels-meta.xml`,
          'labels',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package).toEqual(
          new Map([['labels.labels', new Set(['Label1'])]])
        )
        expect(work.warnings).toHaveLength(0)
        expect(copyFiles).not.toBeCalled()
        expect(outputFile).not.toBeCalled()
      })
    })
  })

  describe('when the entity is partially modified', () => {
    const line =
      'force-app/main/default/sharingRules/Account.sharingRules-meta.xml'
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>${EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<sharingCriteriaRules>${EOL}<fullName>TestCBS</fullName>${EOL}</sharingCriteriaRules>${EOL}<sharingCriteriaRules>${EOL}<fullName>NotWrite</fullName>${EOL}</sharingCriteriaRules>${EOL}</SharingRules>`
    describe('when the change occurs after fullname', () => {
      it('should capture the change and relate it to the right entity', async () => {
        // Arrange
        fileGitDiff.mockImplementation(() =>
          xmlContent.split(EOL).map((x, i) => (i === 4 ? `${MINUS} ${x}` : x))
        )
        readFileFromGit.mockImplementation(() => xmlContent)

        const sut = new InFile(
          `${MODIFICATION}       ${line}`,
          'sharingRules',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(
          work.diffs.package.get('sharingRules.sharingCriteriaRules')
        ).toEqual(new Set(['Account.TestCBS']))
        expect(work.warnings).toHaveLength(0)
        expect(outputFile).toBeCalledWith(
          line,
          expect.stringContaining('TestCBS')
        )
        expect(outputFile).not.toBeCalledWith(
          line,
          expect.stringContaining('NotWrite')
        )
      })
    })

    describe('when a fullname is renamed', () => {
      it('should add the new fullname and delete the old one', async () => {
        // Arrange
        const oldCBS = '<fullName>oldTestCBS</fullName>'
        fileGitDiff.mockImplementation(() => {
          const mockValue = xmlContent
            .split(EOL)
            .map((x, i) => (i === 3 ? `${PLUS} ${x}` : x))
          mockValue.splice(4, 0, `${MINUS} ${oldCBS}`)
          return mockValue
        })
        readFileFromGit.mockImplementation(() => xmlContent)

        const sut = new InFile(
          `${MODIFICATION}       ${line}`,
          'sharingRules',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(
          work.diffs.destructiveChanges.get('sharingRules.sharingCriteriaRules')
        ).toEqual(new Set(['Account.oldTestCBS']))
        expect(
          work.diffs.package.get('sharingRules.sharingCriteriaRules')
        ).toEqual(new Set(['Account.TestCBS']))
        expect(work.warnings).toHaveLength(0)
        expect(outputFile).not.toBeCalledWith(
          line,
          expect.stringContaining('NotWrite')
        )
        expect(outputFile).toBeCalledWith(
          line,
          expect.stringContaining('TestCBS')
        )
      })
    })

    describe('when a new element is inserted', () => {
      it('should add the new element and copy the file', async () => {
        // Arrange
        fileGitDiff.mockImplementation(() =>
          xmlContent
            .split(EOL)
            .map((x, i) => ([2, 3, 4].includes(i) ? `${PLUS} ${x}` : x))
        )
        readFileFromGit.mockImplementation(() => xmlContent)

        const sut = new InFile(
          `${MODIFICATION}       ${line}`,
          'sharingRules',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(
          work.diffs.destructiveChanges.get('sharingRules.sharingCriteriaRules')
        ).toBeUndefined()
        expect(
          work.diffs.package.get('sharingRules.sharingCriteriaRules')
        ).toEqual(new Set(['Account.TestCBS']))
        expect(work.warnings).toHaveLength(0)
        expect(outputFile).not.toBeCalledWith(
          line,
          expect.stringContaining('NotWrite')
        )
        expect(outputFile).toBeCalledWith(
          line,
          expect.stringContaining('TestCBS')
        )
      })
    })

    describe('when an element is removed', () => {
      it('should add the element to the destructiveChanges and not copy the file', async () => {
        // Arrange
        fileGitDiff.mockImplementation(() =>
          xmlContent
            .split(EOL)
            .map((x, i) => ([2, 3, 4].includes(i) ? `${MINUS} ${x}` : x))
        )
        readFileFromGit.mockImplementation(
          () =>
            `<?xml version="1.0" encoding="UTF-8"?>${EOL}<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<sharingCriteriaRules>${EOL}<fullName>NotWrite</fullName>${EOL}</sharingCriteriaRules>${EOL}</SharingRules>`
        )

        const sut = new InFile(
          `${MODIFICATION}       ${line}`,
          'sharingRules',
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(
          work.diffs.destructiveChanges.get('sharingRules.sharingCriteriaRules')
        ).toEqual(new Set(['Account.TestCBS']))
        expect(
          work.diffs.package.get('sharingRules.sharingCriteriaRules')
        ).toBeUndefined()
        expect(work.warnings).toHaveLength(0)
        expect(outputFile).toBeCalledWith(
          line,
          expect.not.stringContaining('<fullName>')
        )
      })
    })
  })

  describe('When entity is deleted', () => {
    const line = 'force-app/main/error/labels/CustomLabels.labels-meta.xml'
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>${EOL}<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">${EOL}<labels>${EOL}<fullName>TestLabel1</fullName>${EOL}</labels>${EOL}</labels>${EOL}<labels>${EOL}<fullName>TestLabel2</fullName>${EOL}</labels>${EOL}</CustomLabels>`
    it('should add the element to the destructiveChanges and not copy the file', async () => {
      // Arrange
      fileGitDiff.mockImplementation(() =>
        xmlContent.split(EOL).map(x => `${MINUS} ${x}`)
      )

      const sut = new InFile(
        `${DELETION}       ${line}`,
        'labels',
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.destructiveChanges.get('labels.labels')).toEqual(
        new Set(['TestLabel1', 'TestLabel2'])
      )
      expect(work.diffs.package.get('labels.labels')).toBeUndefined()
      expect(work.warnings).toHaveLength(0)
      expect(copyFiles).not.toBeCalled()
      expect(outputFile).not.toBeCalled()
    })
  })
})
