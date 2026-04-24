'use strict'
import { PassThrough } from 'node:stream'

const drainWriter = async (
  writer: (out: import('node:stream').Writable) => Promise<void>
): Promise<string> => {
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
  await writer(stream)
  stream.end()
  return Buffer.concat(chunks).toString('utf8')
}

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  FLOW_XML_NAME,
  METAFILE_SUFFIX,
  TRANSLATION_TYPE,
} from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import FlowTranslationProcessor from '../../../../src/post-processor/flowTranslationProcessor'
import {
  ChangeKind,
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { grepContent } from '../../../../src/utils/fsHelper'
import {
  isSubDir,
  pathExists,
  readFile,
  treatPathSep,
} from '../../../../src/utils/fsUtils'
import { parseXmlFileToJson } from '../../../../src/utils/xmlHelper'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
vi.mock('../../../../src/utils/fsUtils')

const mockedGrepContent = vi.mocked(grepContent)
const mockedParseXmlFileToJson = vi.mocked(parseXmlFileToJson)
const mockedIsSubDir = vi.mocked(isSubDir)
const mockedPathExists = vi.mocked(pathExists)
const mockedReadFile = vi.mocked(readFile)
const mockTreatPathSep = vi.mocked(treatPathSep)
mockTreatPathSep.mockImplementation(data => data)

const mockIgnores = vi.fn()
vi.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: vi.fn(() => ({
    globalIgnore: {
      ignores: mockIgnores,
    },
  })),
}))
vi.mock('../../../../src/utils/xmlHelper', async () => {
  // biome-ignore lint/suspicious/noExplicitAny: let TS know it is an object
  const originalModule: any = await vi.importActual(
    '../../../../src/utils/xmlHelper'
  )

  return {
    ...originalModule,
    parseXmlFileToJson: vi.fn(),
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

  describe('process', () => {
    it('Given flowTranslationProcessor, When process, Then completes without error', async () => {
      // Arrange
      const work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)

      // Act & Assert
      await expect(sut.process()).resolves.toBeUndefined()
    })
  })

  describe('isCollector', () => {
    it('Given flowTranslationProcessor, When isCollector, Then returns true', () => {
      // Arrange
      const work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)

      // Act & Assert
      expect(sut.isCollector).toBe(true)
    })
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
      mockedGrepContent.mockResolvedValue([translationPath])
    })

    describe('when no flow have been modified', () => {
      it('should not even look for translation files', async () => {
        // Act
        const result = await sut.transformAndCollect()

        // Assert
        expect(mockedGrepContent).not.toHaveBeenCalled()
        expect(hasTranslationManifest(result)).toBe(false)
      })
    })

    describe('when flow have been modified', () => {
      beforeEach(() => {
        // Arrange
        work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
        mockedParseXmlFileToJson.mockResolvedValue({
          Translations: { flowDefinitions: { fullName: flowFullName } },
        })
      })

      describe('when there is no translation file', () => {
        beforeEach(() => {
          // Arrange
          mockedGrepContent.mockResolvedValue([])
        })
        it('should not add translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(hasTranslationManifest(result)).toBe(false)
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
          expect(hasTranslationManifest(result)).toBe(false)
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
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
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalledTimes(1)
          expect(hasTranslationManifest(result)).toBe(true)
          expect(result.copies).toHaveLength(1)
          expect(result.copies[0].kind).toBe(CopyOperationKind.StreamedContent)
        })
      })

      describe('when there is already a translation with flow definition related to a flow', () => {
        beforeEach(() => {
          // Arrange
          work.changes.add(ChangeKind.Modify, TRANSLATION_TYPE, FR)
          work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
          mockedPathExists.mockResolvedValue(true as never)
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>TestA</fullName></flowDefinitions><flowDefinitions><fullName>TestB</fullName></flowDefinitions></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalled()
          expect(result.copies).toHaveLength(1)
          const copy = result.copies[0]
          expect(copy.kind).toBe(CopyOperationKind.StreamedContent)
          expect(copy.path).toBe(translationPath)
          if (copy.kind === CopyOperationKind.StreamedContent) {
            expect(await drainWriter(copy.writer)).toContain('test-flow')
            expect(await drainWriter(copy.writer)).toContain('TestA')
            expect(await drainWriter(copy.writer)).toContain('TestB')
          }
        })
      })

      describe('when there is no copied flowTranslation changed already for the flow', () => {
        beforeEach(() => {
          // Arrange
          // Note: TRANSLATION_TYPE / FR deliberately not added here
          work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
          mockedPathExists.mockResolvedValue(true as never)
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"></Translations>`
          )
        })
        it('the flowDefinitions translations should be added to the translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
            work.config
          )
          expect(parseXmlFileToJson).toHaveBeenCalled()
          expect(result.copies).toHaveLength(1)
          const copy = result.copies[0]
          expect(copy.kind).toBe(CopyOperationKind.StreamedContent)
          expect(copy.path).toBe(translationPath)
          if (copy.kind === CopyOperationKind.StreamedContent) {
            expect(await drainWriter(copy.writer)).toContain('test-flow')
          }
        })
      })

      describe('when there is multiple translation file with multiple flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedGrepContent.mockResolvedValue([
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
            expect(hasTranslationManifest(result)).toBe(false)
            expect(mockedGrepContent).toHaveBeenCalledTimes(1)
            expect(mockedGrepContent).toHaveBeenCalledWith(
              'flowDefinitions',
              work.config.source.map(
                (s: string) => `${s}/*.translation-meta.xml`
              ),
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
              work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
              work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, 'otherFlow')
              work.config.generateDelta = generateDelta
            })
            it('should add translation', async () => {
              // Arrange

              // Act
              const result = await sut.transformAndCollect()

              // Assert
              expect(hasTranslationManifest(result)).toBe(true)
              expect(result.manifests).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({
                    target: ManifestTarget.Package,
                    type: TRANSLATION_TYPE,
                  }),
                ])
              )
              expect(mockedGrepContent).toHaveBeenCalledTimes(1)
              expect(mockedGrepContent).toHaveBeenCalledWith(
                'flowDefinitions',
                work.config.source.map(
                  (s: string) => `${s}/*.translation-meta.xml`
                ),
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
          expect(hasTranslationManifest(result)).toBe(false)
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(result.copies).toHaveLength(0)
        })
      })

      describe('when translation files are not ignored', () => {
        beforeEach(() => {
          // Arrange
          work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
          work.config.ignore = '.forceignore'
          mockIgnores.mockReturnValue(false)
        })
        it('should add translation file', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(hasTranslationManifest(result)).toBe(true)
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
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
          expect(hasTranslationManifest(result)).toBe(false)
          expect(mockedGrepContent).toHaveBeenCalledTimes(1)
          expect(mockedGrepContent).toHaveBeenCalledWith(
            'flowDefinitions',
            work.config.source.map(
              (s: string) => `${s}/*.translation-meta.xml`
            ),
            work.config
          )
          expect(parseXmlFileToJson).not.toHaveBeenCalled()
          expect(result.copies).toHaveLength(0)
        })
      })
    })
  })
})
