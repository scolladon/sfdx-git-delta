'use strict'
const FlowTranslationProcessor = require('../../../../src/post-processor/flowTranslationProcessor')
const { mockParse } = require('fast-xml-parser')
const {
  FLOW_DIRECTORY_NAME,
  TRANSLATION_TYPE,
} = require('../../../../src/utils/metadataConstants')
const { copyFiles, scanExtension } = require('../../../../src/utils/fsHelper')
jest.mock('fs-extra')
jest.mock('fast-xml-parser')
jest.mock('../../../../src/utils/fsHelper', () => ({
  scanExtension: jest.fn(),
  copyFiles: jest.fn(),
  readFile: jest.fn(),
}))
const mockForPath = jest.fn()
jest.mock('../../../../src/utils/ignoreHelper', () => {
  return jest.fn().mockImplementation(() => {
    return { forPath: mockForPath }
  })
})

const FR = 'fr'
const EN = 'en'
const flowFullName = 'test-flow'

const trueAfter = (attempt = 0) => {
  let count = 0
  return () => count++ >= attempt
}

describe('FlowTranslationProcessor', () => {
  let work
  describe('process', () => {
    let sut
    let flap
    beforeEach(() => {
      work = {
        diffs: {
          package: new Map(),
          destructiveChanges: new Map(),
        },
        config: { repo: 'repo', output: 'output', generateDelta: true },
      }
      sut = new FlowTranslationProcessor(work)
      flap = trueAfter(1)
      scanExtension.mockImplementationOnce(() => ({
        [Symbol.asyncIterator]: () => ({
          next: () => ({
            value: `${FR}.translation-meta.xml`,
            done: flap(),
          }),
        }),
      }))
    })

    describe('when there is no translation file', () => {
      beforeEach(() => {
        // Arrange
        flap = () => true
      })
      it('should not add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockParse).not.toHaveBeenCalled()
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when there is a translation file without flow def', () => {
      beforeEach(() => {
        // Arrange
        mockParse.mockImplementationOnce(() => ({}))
      })
      it('should not add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockParse).toHaveBeenCalledTimes(1)
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when there is a translation file with one flow def', () => {
      beforeEach(() => {
        // Arrange
        work.diffs.package = new Map([
          [FLOW_DIRECTORY_NAME, new Set([flowFullName])],
        ])
        mockParse.mockImplementation(() => ({
          Translations: { flowDefinitions: { fullName: flowFullName } },
        }))
      })
      it('should add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockParse).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalled()
      })
    })

    describe('when there is already a translation related to a flow', () => {
      beforeEach(() => {
        // Arrange
        work.diffs.package = new Map([[TRANSLATION_TYPE, new Set([FR])]])
      })
      it('should not treat again the translation', async () => {
        // Act
        await sut.process()

        // Assert
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockParse).not.toHaveBeenCalled()
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when there is multiple translation file with multiple flow def', () => {
      beforeEach(() => {
        // Arrange
        flap = trueAfter(2)
        let count = 0
        const getTranslationName = () =>
          [`${FR}.translation-meta.xml`, `${EN}.translation-meta.xml`][count++]
        scanExtension.mockImplementationOnce(() => ({
          [Symbol.asyncIterator]: () => ({
            next: () => ({
              value: getTranslationName(),
              done: flap(),
            }),
          }),
        }))
      })
      describe('when there is no flow matching the translation', () => {
        beforeEach(() => {
          mockParse.mockImplementation(() => ({
            Translations: { flowDefinitions: [{ fullName: 'wrong' }] },
          }))
        })
        it('should not add translation', async () => {
          // Arrange

          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(mockParse).toHaveBeenCalledTimes(2)
          expect(copyFiles).not.toHaveBeenCalled()
        })
      })

      describe('when there is flow matching the translation', () => {
        describe.each([true, false])(
          'when config.generateDelta is %s',
          generateDelta => {
            beforeEach(() => {
              mockParse.mockImplementation(() => ({
                Translations: { flowDefinitions: [{ fullName: flowFullName }] },
              }))
              work.diffs.package = new Map([
                [FLOW_DIRECTORY_NAME, new Set([flowFullName])],
              ])
              work.config.generateDelta = generateDelta
            })
            it('should add translation', async () => {
              // Arrange

              // Act
              await sut.process()

              // Assert
              expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
              expect(scanExtension).toHaveBeenCalledTimes(1)
              expect(mockParse).toHaveBeenCalledTimes(2)
              if (generateDelta) expect(copyFiles).toHaveBeenCalledTimes(2)
              else expect(copyFiles).not.toHaveBeenCalled()
            })
          }
        )
      })
    })

    describe('when translation files are ignored', () => {
      beforeEach(() => {
        // Arrange
        work.config.ignore = '.forceignore'
        mockForPath.mockResolvedValue({ ignores: () => true })
      })
      it('should not add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockForPath).toHaveBeenCalledTimes(1)
        expect(mockParse).not.toHaveBeenCalled()
        expect(copyFiles).not.toHaveBeenCalled()
      })
    })

    describe('when translation files are not ignored', () => {
      beforeEach(() => {
        // Arrange
        work.diffs.package = new Map([
          [FLOW_DIRECTORY_NAME, new Set([flowFullName])],
        ])
        work.config.ignore = '.forceignore'
        mockForPath.mockResolvedValue({ ignores: () => false })
      })
      it('should add translation file', async () => {
        // Act
        await sut.process()

        // Assert
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
        expect(scanExtension).toHaveBeenCalledTimes(1)
        expect(mockForPath).toHaveBeenCalledTimes(1)
        expect(mockParse).toHaveBeenCalledTimes(1)
        expect(copyFiles).toHaveBeenCalledTimes(1)
      })
    })
  })
})
