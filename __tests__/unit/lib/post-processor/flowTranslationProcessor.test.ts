'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import {
  FLOW_XML_NAME,
  METAFILE_SUFFIX,
  TRANSLATION_TYPE,
} from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import FlowTranslationProcessor from '../../../../src/post-processor/flowTranslationProcessor'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { readDirs } from '../../../../src/utils/fsHelper'
import {
  isSubDir,
  pathExists,
  readFile,
  treatPathSep,
} from '../../../../src/utils/fsUtils'
import { parseXmlFileToJson } from '../../../../src/utils/xmlHelper'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/fsUtils')

const mockedReadDirs = jest.mocked(readDirs)
const mockedParseXmlFileToJson = jest.mocked(parseXmlFileToJson)
const mockedIsSubDir = jest.mocked(isSubDir)
const mockedPathExists = jest.mocked(pathExists)
const mockedReadFile = jest.mocked(readFile)
const mockTreatPathSep = jest.mocked(treatPathSep)
mockTreatPathSep.mockImplementation(data => data)

const mockIgnores = jest.fn()
jest.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: jest.fn(() => ({
    globalIgnore: {
      ignores: mockIgnores,
    },
  })),
}))
jest.mock('../../../../src/utils/xmlHelper', () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const originalModule: any = jest.requireActual(
    '../../../../src/utils/xmlHelper'
  )

  return {
    ...originalModule,
    parseXmlFileToJson: jest.fn(),
  }
})

const FR = 'fr'
const flowFullName = 'test-flow'

const cardinalProduct = (a: string[], b: string[]): string[][] =>
  a.reduce((acc, x) => [...acc, ...b.map(y => [x, y])], [] as string[][])

const hasTranslationManifest = (result: { manifests: { type: string }[] }) =>
  result.manifests.some(m => m.type === TRANSLATION_TYPE)

describe('FlowTranslationProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  describe.each(
    cardinalProduct(
      [`${FR}.translation${METAFILE_SUFFIX}`, `${FR}.translation`],
      ['.', 'output']
    )
  )('process "%s" translation, with "%s" output', (translationPath, outputPath) => {
    let sut: FlowTranslationProcessor
    beforeEach(() => {
      mockIgnores.mockReturnValue(false)
      mockedIsSubDir.mockImplementation(() => false)
      work = getWork()
      work.config.repo = './'
      work.config.output = outputPath
      sut = new FlowTranslationProcessor(work, metadata)
      mockedReadDirs.mockResolvedValue([translationPath])
    })

    describe('when no flow have been modified', () => {
      it('should not even look for translation files', async () => {
        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(mockedReadDirs).not.toHaveBeenCalled()
        expect(hasTranslationManifest(result)).toBeFalsy()
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
          mockedReadDirs.mockResolvedValue([])
        })
        it('should not add translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(hasTranslationManifest(result)).toBeFalsy()
          expect(result.copies).toHaveLength(0)
        })
      })

      describe('when there is a translation file without flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedParseXmlFileToJson.mockResolvedValue({})
        })
        it('should not add translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(hasTranslationManifest(result)).toBeFalsy()
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(result.copies).toHaveLength(0)
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
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(hasTranslationManifest(result)).toBeTruthy()
          expect(result.copies).toHaveLength(1)
          expect(result.copies[0].kind).toBe(CopyOperationKind.ComputedContent)
        })
      })

      describe('when there is already a translation with flow definition related to a flow', () => {
        beforeEach(() => {
          // Arrange
          work.diffs.package = new Map([
            [TRANSLATION_TYPE, new Set([FR])],
            [FLOW_XML_NAME, new Set([flowFullName])],
          ])
          mockedPathExists.mockResolvedValue(true as never)
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>TestA</fullName></flowDefinitions><flowDefinitions><fullName>TestB</fullName></flowDefinitions></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalled()
          expect(result.copies).toHaveLength(1)
          const copy = result.copies[0]
          expect(copy.kind).toBe(CopyOperationKind.ComputedContent)
          expect(copy.path).toBe(translationPath)
          if (copy.kind === CopyOperationKind.ComputedContent) {
            expect(copy.content).toContain('test-flow')
            expect(copy.content).toContain('TestA')
            expect(copy.content).toContain('TestB')
          }
        })
      })

      describe('when there is no copied flowTranslation changed already for the flow', () => {
        beforeEach(() => {
          // Arrange
          work.diffs.package = new Map([
            //[TRANSLATION_TYPE, new Set([FR])],
            [FLOW_XML_NAME, new Set([flowFullName])],
          ])
          mockedPathExists.mockResolvedValue(true as never)
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalled()
          expect(result.copies).toHaveLength(1)
          const copy = result.copies[0]
          expect(copy.kind).toBe(CopyOperationKind.ComputedContent)
          expect(copy.path).toBe(translationPath)
          if (copy.kind === CopyOperationKind.ComputedContent) {
            expect(copy.content).toContain('test-flow')
          }
        })
      })

      describe('when there is multiple translation file with multiple flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedReadDirs.mockResolvedValue([
            translationPath,
            `fr_${translationPath}`,
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
            const result = await sut.transformAndCollect()

            // Assert
            expect(hasTranslationManifest(result)).toBeFalsy()
            expect(mockedReadDirs).toHaveBeenCalledTimes(1)
            expect(mockedReadDirs).toHaveBeenCalledWith(
              work.config.source,
              work.config
            )
            expect(parseXmlFileToJson).toHaveBeenCalledTimes(2)
            expect(result.copies).toHaveLength(0)
          })
        })

        describe('when there is flow matching the translation', () => {
          describe.each<boolean>([
            true,
            false,
          ])('when config.generateDelta is %s', generateDelta => {
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
              const result = await sut.transformAndCollect()

              // Assert
              expect(hasTranslationManifest(result)).toBeTruthy()
              expect(result.manifests).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({
                    target: ManifestTarget.Package,
                    type: TRANSLATION_TYPE,
                  }),
                ])
              )
              expect(mockedReadDirs).toHaveBeenCalledTimes(1)
              expect(mockedReadDirs).toHaveBeenCalledWith(
                work.config.source,
                work.config
              )
              expect(parseXmlFileToJson).toHaveBeenCalledTimes(2)
              if (generateDelta) expect(result.copies).toHaveLength(2)
              else expect(result.copies).toHaveLength(0)
            })
          })
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
          const result = await sut.transformAndCollect()

          // Assert
          expect(hasTranslationManifest(result)).toBeFalsy()
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(result.copies).toHaveLength(0)
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
          const result = await sut.transformAndCollect()

          // Assert
          expect(hasTranslationManifest(result)).toBeTruthy()
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(result.copies).toHaveLength(1)
        })
      })

      describe('when the translation file is subDir of output', () => {
        beforeEach(() => {
          // Arrange
          const out = 'out'
          work.config.output = out
          mockedParseXmlFileToJson.mockResolvedValue({})
          mockedIsSubDir.mockImplementation(() => true)
        })
        it('should not add translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(hasTranslationManifest(result)).toBeFalsy()
          expect(mockedReadDirs).toHaveBeenCalledTimes(1)
          expect(mockedReadDirs).toHaveBeenCalledWith(
            work.config.source,
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(result.copies).toHaveLength(0)
        })
      })
    })
  })
})
