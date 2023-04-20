'use strict'
const LwcHandler = require('../../../../src/service/lwcHandler')
const { copyFiles, readDir } = require('../../../../src/utils/fsHelper')
const {
  ADDITION,
  DELETION,
  MODIFICATION,
} = require('../../../../src/utils/gitConstants')

jest.mock('../../../../src/utils/fsHelper')

readDir.mockImplementationOnce(() => Promise.resolve([]))

const objectType = 'lwc'
const element = 'component'
const basePath = `force-app/main/default/${objectType}`
const entityPath = `${basePath}/${element}/${element}.js`
const xmlName = 'LightningComponentBundle'
let work
beforeEach(() => {
  jest.clearAllMocks()
  work = {
    config: { output: '', repo: '', generateDelta: true },
    diffs: { package: new Map(), destructiveChanges: new Map() },
  }
})

describe('lwcHandler', () => {
  let globalMetadata
  beforeAll(async () => {
    // eslint-disable-next-line no-undef
    globalMetadata = await getGlobalMetadata()
  })
  describe('when the line should not be processed', () => {
    it.each([`${basePath}/.eslintrc.json`, `${basePath}/jsconfig.json`])(
      'does not handle the line',
      async entityPath => {
        // Arrange
        const sut = new LwcHandler(
          `${ADDITION}       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.size).toBe(0)
        expect(copyFiles).not.toHaveBeenCalled()
      }
    )
  })

  describe('when the line should be processed', () => {
    it.each([ADDITION, MODIFICATION])(
      'handles the line for "%s" type change',
      async changeType => {
        // Arrange
        const sut = new LwcHandler(
          `${changeType}       ${entityPath}`,
          objectType,
          work,
          globalMetadata
        )

        // Act
        await sut.handle()

        // Assert
        expect(work.diffs.package.get(xmlName)).toEqual(new Set([element]))
        expect(copyFiles).toHaveBeenCalled()
      }
    )

    it('handles the line for "D" type change', async () => {
      // Arrange
      const sut = new LwcHandler(
        `${DELETION}       ${entityPath}`,
        objectType,
        work,
        globalMetadata
      )

      // Act
      await sut.handle()

      // Assert
      expect(work.diffs.destructiveChanges.get(xmlName)).toEqual(
        new Set([element])
      )
      expect(copyFiles).not.toHaveBeenCalled()
    })
  })
})
