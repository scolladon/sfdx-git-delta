'use strict'
const FlowTranslationProcessor = require('../../../../src/post-processor/flowTranslationProcessor')
const { parseXmlFileToJson } = require('../../../../src/utils/fxpHelper')
const {
  FLOW_XML_NAME,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} = require('../../../../src/utils/metadataConstants')
const {
  writeFile,
  scanExtension,
  isSubDir,
  readFile,
} = require('../../../../src/utils/fsHelper')
const { forPath } = require('../../../../src/utils/ignoreHelper')
const { pathExists } = require('fs-extra')
jest.mock('fs-extra')
jest.mock('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/ignoreHelper')
jest.mock('../../../../src/utils/fxpHelper', () => {
  const originalModule = jest.requireActual('../../../../src/utils/fxpHelper')

  return {
    ...originalModule,
    parseXmlFileToJson: jest.fn(),
  }
})

const FR = 'fr'
const EN = 'en'
const flowFullName = 'test-flow'
const EXTENSION = `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`

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
        config: { source: './', output: 'output', generateDelta: true },
      }
      sut = new FlowTranslationProcessor(work)
      flap = trueAfter(1)
      scanExtension.mockImplementation(() => ({
        [Symbol.asyncIterator]: () => ({
          next: () => ({
            value: `${FR}.translation-meta.xml`,
            done: flap(),
          }),
        }),
      }))
    })

    describe('when no flow have been modified', () => {
      it('should not even look for translation files', async () => {
        // Act
        await sut.process()

        // Assert
        expect(scanExtension).not.toHaveBeenCalled()
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
      })
    })

    describe('when flow have been modified', () => {
      beforeEach(() => {
        // Arrange
        work.diffs.package = new Map([[FLOW_XML_NAME, new Set([flowFullName])]])
        parseXmlFileToJson.mockResolvedValue({
          Translations: { flowDefinitions: { fullName: flowFullName } },
        })
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
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        })
      })

      describe('when there is a translation file without flow def', () => {
        beforeEach(() => {
          // Arrange
          parseXmlFileToJson.mockResolvedValueOnce({})
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(writeFile).not.toHaveBeenCalled()
        })
      })

      describe('when there is a translation file with one flow def', () => {
        beforeEach(() => {
          // Arrange
          parseXmlFileToJson.mockResolvedValue({
            Translations: { flowDefinitions: { fullName: flowFullName } },
          })
        })
        it('should add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(writeFile).toHaveBeenCalled()
        })
      })

      describe('when there is already a translation with flow definition related to a flow', () => {
        beforeEach(() => {
          // Arrange
          work.diffs.package = new Map([
            [TRANSLATION_TYPE, new Set([FR])],
            [FLOW_XML_NAME, new Set([flowFullName])],
          ])
          pathExists.mockResolvedValue(true)
          readFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>TestA</fullName></flowDefinitions><flowDefinitions><fullName>TestB</fullName></flowDefinitions></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalledTimes(1)
          expect(writeFile).toHaveBeenCalledWith(
            'fr.translation-meta.xml',
            expect.stringContaining('test-flow'),
            work.config
          )
          expect(writeFile).toHaveBeenCalledWith(
            'fr.translation-meta.xml',
            expect.stringContaining('TestB'),
            work.config
          )
          expect(writeFile).toHaveBeenCalledWith(
            'fr.translation-meta.xml',
            expect.stringContaining('TestA'),
            work.config
          )
        })
      })

      describe('when there is no copied flowTranslation changed already for the flow', () => {
        beforeEach(() => {
          // Arrange
          work.diffs.package = new Map([
            //[TRANSLATION_TYPE, new Set([FR])],
            [FLOW_XML_NAME, new Set([flowFullName])],
          ])
          pathExists.mockResolvedValue(true)
          readFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalled()
          expect(writeFile).toHaveBeenCalledTimes(1)
          expect(writeFile).toHaveBeenCalledWith(
            'fr.translation-meta.xml',
            expect.stringContaining('test-flow'),
            work.config
          )
        })
      })

      describe('when there is multiple translation file with multiple flow def', () => {
        beforeEach(() => {
          // Arrange
          flap = trueAfter(2)
          let count = 0
          const getTranslationName = () =>
            [`${FR}.translation-meta.xml`, `${EN}.translation-meta.xml`][
              count++
            ]
          scanExtension.mockImplementation(() => ({
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
            parseXmlFileToJson.mockResolvedValue({
              Translations: { flowDefinitions: [{ fullName: 'wrong' }] },
            })
          })
          it('should not add translation', async () => {
            // Arrange

            // Act
            await sut.process()

            // Assert
            expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
            expect(scanExtension).toHaveBeenCalledTimes(1)
            expect(scanExtension).toHaveBeenCalledWith(
              work.config.source,
              EXTENSION,
              work.config
            )
            expect(parseXmlFileToJson).toHaveBeenCalledTimes(2)
            expect(writeFile).not.toHaveBeenCalled()
          })
        })

        describe('when there is flow matching the translation', () => {
          describe.each([true, false])(
            'when config.generateDelta is %s',
            generateDelta => {
              beforeEach(() => {
                parseXmlFileToJson.mockResolvedValue({
                  Translations: {
                    flowDefinitions: [
                      { fullName: flowFullName },
                      { fullName: 'otherFlow' },
                    ],
                  },
                })
                work.diffs.package = new Map([
                  [FLOW_XML_NAME, new Set([flowFullName, 'otherFlow'])],
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
                expect(scanExtension).toHaveBeenCalledWith(
                  work.config.source,
                  EXTENSION,
                  work.config
                )
                expect(parseXmlFileToJson).toHaveBeenCalledTimes(2)
                if (generateDelta) expect(writeFile).toHaveBeenCalledTimes(2)
                else expect(writeFile).not.toHaveBeenCalled()
              })
            }
          )
        })
      })

      describe('when translation files are ignored', () => {
        beforeEach(() => {
          // Arrange
          work.config.ignore = '.forceignore'
          forPath.mockResolvedValue({ ignores: () => true })
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(forPath).toHaveBeenCalledTimes(1)
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        })
      })

      describe('when translation files are not ignored', () => {
        beforeEach(() => {
          // Arrange
          work.diffs.package = new Map([
            [FLOW_XML_NAME, new Set([flowFullName])],
          ])
          work.config.ignore = '.forceignore'
          forPath.mockResolvedValue({ ignores: () => false })
        })
        it('should add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(forPath).toHaveBeenCalledTimes(1)
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(writeFile).toHaveBeenCalledTimes(1)
        })
      })

      describe('when the translation file is subDir of output', () => {
        beforeEach(() => {
          // Arrange
          const out = 'out'
          work.config.output = out
          scanExtension.mockImplementation(() => ({
            [Symbol.asyncIterator]: () => ({
              next: () => ({
                value: `${out}/${FR}.translation-meta.xml`,
                done: flap(),
              }),
            }),
          }))
          parseXmlFileToJson.mockResolvedValueOnce({})
          isSubDir.mockImplementation(() => true)
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(scanExtension).toHaveBeenCalledTimes(1)
          expect(scanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        })
      })
    })
  })
})
