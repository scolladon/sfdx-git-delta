'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'
import { pathExists } from 'fs-extra'
import FlowTranslationProcessor from '../../../../src/post-processor/flowTranslationProcessor'
import { parseXmlFileToJson } from '../../../../src/utils/fxpHelper'
import {
  FLOW_XML_NAME,
  METAFILE_SUFFIX,
  TRANSLATION_EXTENSION,
  TRANSLATION_TYPE,
} from '../../../../src/constant/metadataConstants'
import { writeFile, scanExtension } from '../../../../src/utils/fsHelper'
import { isSubDir, readFile } from '../../../../src/utils/fsUtils'
import { Work } from '../../../../src/types/work'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'

jest.mock('fs-extra')
jest.mock('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/fsUtils')

const mockedScanExtension = jest.mocked(scanExtension)
const mockedParseXmlFileToJson = jest.mocked(parseXmlFileToJson)
const mockedIsSubDir = jest.mocked(isSubDir)
const mockedPathExists = jest.mocked(pathExists)
const mockedReadFile = jest.mocked(readFile)

const mockIgnores = jest.fn()
jest.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: jest.fn(() => ({
    globalIgnore: {
      ignores: mockIgnores,
    },
  })),
}))
jest.mock('../../../../src/utils/fxpHelper', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originalModule: any = jest.requireActual(
    '../../../../src/utils/fxpHelper'
  )

  return {
    ...originalModule,
    parseXmlFileToJson: jest.fn(),
  }
})

const FR = 'fr'
const EN = 'en'
const flowFullName = 'test-flow'
const EXTENSION = `${TRANSLATION_EXTENSION}${METAFILE_SUFFIX}`

describe('FlowTranslationProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getGlobalMetadata()
  })

  describe('process', () => {
    let sut: FlowTranslationProcessor
    beforeEach(() => {
      mockIgnores.mockReset()
      work = getWork()
      sut = new FlowTranslationProcessor(work, metadata)
      mockedScanExtension.mockResolvedValue([`${FR}.translation-meta.xml`])
    })

    describe('when no flow have been modified', () => {
      it('should not even look for translation files', async () => {
        // Act
        await sut.process()

        // Assert
        expect(mockedScanExtension).not.toHaveBeenCalled()
        expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
      })
    })

    describe('when flow have been modified', () => {
      beforeEach(() => {
        // Arrange
        work.diffs.package = new Map([[FLOW_XML_NAME, new Set([flowFullName])]])
        mockedParseXmlFileToJson.mockResolvedValue({
          Translations: { flowDefinitions: { fullName: flowFullName } },
        })
      })

      describe('when there is no translation file', () => {
        beforeEach(() => {
          // Arrange
          mockedScanExtension.mockResolvedValue([])
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
        })
      })

      describe('when there is a translation file without flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedParseXmlFileToJson.mockResolvedValueOnce({})
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
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
          mockedParseXmlFileToJson.mockResolvedValue({
            Translations: { flowDefinitions: { fullName: flowFullName } },
          })
        })
        it('should add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
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
          mockedPathExists.mockImplementation(() => Promise.resolve(true))
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>TestA</fullName></flowDefinitions><flowDefinitions><fullName>TestB</fullName></flowDefinitions></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
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
            expect.stringContaining('TestA'),
            work.config
          )
          expect(writeFile).toHaveBeenCalledWith(
            'fr.translation-meta.xml',
            expect.stringContaining('TestB'),
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
          mockedPathExists.mockImplementation(() => Promise.resolve(true))
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
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
          mockedScanExtension.mockResolvedValue([
            `${FR}.translation-meta.xml`,
            `${EN}.translation-meta.xml`,
          ])
        })
        describe('when there is no flow matching the translation', () => {
          beforeEach(() => {
            mockedParseXmlFileToJson.mockResolvedValue({
              Translations: { flowDefinitions: [{ fullName: 'wrong' }] },
            })
          })
          it('should not add translation', async () => {
            // Arrange

            // Act
            await sut.process()

            // Assert
            expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
            expect(mockedScanExtension).toHaveBeenCalledTimes(1)
            expect(mockedScanExtension).toHaveBeenCalledWith(
              work.config.source,
              EXTENSION,
              work.config
            )
            expect(parseXmlFileToJson).toHaveBeenCalledTimes(2)
            expect(writeFile).not.toHaveBeenCalled()
          })
        })

        describe('when there is flow matching the translation', () => {
          describe.each<boolean>([true, false])(
            'when config.generateDelta is %s',
            generateDelta => {
              beforeEach(() => {
                mockedParseXmlFileToJson.mockResolvedValue({
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
                expect(mockedScanExtension).toHaveBeenCalledTimes(1)
                expect(mockedScanExtension).toHaveBeenCalledWith(
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
          mockIgnores.mockReturnValue(true)
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
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
          mockIgnores.mockReturnValue(false)
        })
        it('should add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
            work.config.source,
            EXTENSION,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(writeFile).toHaveBeenCalledTimes(1)
        })
      })

      describe('when the translation file is subDir of output', () => {
        beforeEach(() => {
          // Arrange
          const out = 'out'
          work.config.output = out
          mockedParseXmlFileToJson.mockResolvedValueOnce({})
          mockedIsSubDir.mockImplementation(() => true)
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(mockedScanExtension).toHaveBeenCalledTimes(1)
          expect(mockedScanExtension).toHaveBeenCalledWith(
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
