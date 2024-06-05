'use strict'
import { expect, jest, describe, it } from '@jest/globals'
import { pathExists } from 'fs-extra'

import {
  FLOW_XML_NAME,
  TRANSLATION_TYPE,
} from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import FlowTranslationProcessor from '../../../../src/post-processor/flowTranslationProcessor'
import type { Work } from '../../../../src/types/work'
import { writeFile, readDir } from '../../../../src/utils/fsHelper'
import { isSubDir, readFile, treatPathSep } from '../../../../src/utils/fsUtils'
import { parseXmlFileToJson } from '../../../../src/utils/fxpHelper'
import { IgnoreHelper } from '../../../../src/utils/ignoreHelper'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('fs-extra')
jest.mock('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/fsUtils')

const mockedReadDir = jest.mocked(readDir)
const mockedParseXmlFileToJson = jest.mocked(parseXmlFileToJson)
const mockedIsSubDir = jest.mocked(isSubDir)
const mockedPathExists = jest.mocked(pathExists)
const mockedReadFile = jest.mocked(readFile)
const mockTreatPathSep = jest.mocked(treatPathSep)
mockTreatPathSep.mockImplementation(data => data)

const mockKeep = jest.fn()
jest.spyOn(IgnoreHelper, 'getIgnoreInstance').mockResolvedValue({
  keep: mockKeep,
} as never)

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

describe('FlowTranslationProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getGlobalMetadata()
  })

  describe('process', () => {
    let sut: FlowTranslationProcessor
    beforeEach(() => {
      //mockKeep.mockReset()
      work = getWork()
      sut = new FlowTranslationProcessor(work, metadata)
      mockedReadDir.mockResolvedValue([`${FR}.translation-meta.xml`])
    })

    describe('when no flow have been modified', () => {
      it('should not even look for translation files', async () => {
        // Act
        await sut.process()

        // Assert
        expect(mockedReadDir).not.toHaveBeenCalled()
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
          mockedReadDir.mockResolvedValue([])
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
        })
      })

      describe('when there is a translation file without flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedParseXmlFileToJson.mockResolvedValueOnce({})
          mockKeep.mockReturnValue(true)
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).toHaveBeenCalledTimes(1)
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
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).toHaveBeenCalledTimes(1)
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
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).toHaveBeenCalled()
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
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).toHaveBeenCalled()
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
          mockedReadDir.mockResolvedValue([
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
            expect(mockedReadDir).toHaveBeenCalledTimes(1)
            expect(mockedReadDir).toHaveBeenCalledWith(
              work.config.source,
              work.config
            )
            expect(mockedParseXmlFileToJson).toHaveBeenCalledTimes(2)
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
                expect(mockedReadDir).toHaveBeenCalledTimes(1)
                expect(mockedReadDir).toHaveBeenCalledWith(
                  work.config.source,
                  work.config
                )
                expect(mockedParseXmlFileToJson).toHaveBeenCalledTimes(2)
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
          mockKeep.mockReturnValue(false)
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).not.toHaveBeenCalled()
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
          mockKeep.mockReturnValue(true)
        })
        it('should add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeTruthy()
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(writeFile).toHaveBeenCalledTimes(1)
        })
      })

      describe('when the translation file is subDir of output', () => {
        beforeEach(() => {
          // Arrange
          const out = 'out'
          work.config.output = out
          mockedParseXmlFileToJson.mockResolvedValueOnce({})
          mockedIsSubDir.mockReturnValue(true)
        })
        it('should not add translation file', async () => {
          // Act
          await sut.process()

          // Assert
          expect(work.diffs.package.has(TRANSLATION_TYPE)).toBeFalsy()
          expect(mockedReadDir).toHaveBeenCalledTimes(1)
          expect(mockedReadDir).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(mockedParseXmlFileToJson).not.toHaveBeenCalled()
          expect(writeFile).not.toHaveBeenCalled()
        })
      })
    })
  })
})
