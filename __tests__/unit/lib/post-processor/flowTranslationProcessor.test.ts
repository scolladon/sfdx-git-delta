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
import { grepContent, readPathFromGit } from '../../../../src/utils/fsHelper'
import {
  isSubDir,
  pathExists,
  readFile,
  treatPathSep,
} from '../../../../src/utils/fsUtils'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
vi.mock('../../../../src/utils/fsUtils')

const mockedGrepContent = vi.mocked(grepContent)
const mockedReadPathFromGit = vi.mocked(readPathFromGit)
const mockedIsSubDir = vi.mocked(isSubDir)
const mockedPathExists = vi.mocked(pathExists)
const mockedReadFile = vi.mocked(readFile)
const mockTreatPathSep = vi.mocked(treatPathSep)
mockTreatPathSep.mockImplementation(data => data)

const translationXml = (flowDefinitions: Array<{ fullName: string }>) => {
  const defs = flowDefinitions
    .map(
      flowDef =>
        `  <flowDefinitions><fullName>${flowDef.fullName}</fullName></flowDefinitions>`
    )
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Translations xmlns="http://soap.sforce.com/2006/04/metadata">\n${defs}\n</Translations>`
}
const emptyTranslationXml = `<?xml version="1.0" encoding="UTF-8"?>\n<Translations xmlns="http://soap.sforce.com/2006/04/metadata">\n</Translations>`

const mockIgnores = vi.fn()
vi.mock('../../../../src/utils/ignoreHelper', () => ({
  buildIgnoreHelper: vi.fn(() => ({
    globalIgnore: {
      ignores: mockIgnores,
    },
  })),
}))

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
        mockedReadPathFromGit.mockResolvedValue(
          translationXml([{ fullName: flowFullName }])
        )
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
          expect(mockedReadPathFromGit).not.toHaveBeenCalled()
          expect(hasTranslationManifest(result)).toBe(false)
          expect(result.copies).toHaveLength(0)
        })
      })

      describe('when there is a translation file without flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedReadPathFromGit.mockResolvedValue(emptyTranslationXml)
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
          expect(mockedReadPathFromGit).toHaveBeenCalledTimes(1)
          expect(result.copies).toHaveLength(0)
        })
      })

      describe('when there is a translation file with one flow def', () => {
        beforeEach(() => {
          // Arrange
          mockedReadPathFromGit.mockResolvedValue(
            translationXml([{ fullName: flowFullName }])
          )
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
          expect(mockedReadPathFromGit).toHaveBeenCalledTimes(1)
          expect(hasTranslationManifest(result)).toBe(true)
          expect(result.copies).toHaveLength(1)
          expect(result.copies[0].kind).toBe(CopyOperationKind.StreamedContent)
        })
      })

      describe('when the output translation contains a non-flowDefinitions sibling', () => {
        beforeEach(() => {
          // Arrange — a customFieldTranslations sibling must pass through
          // unchanged while flowDefinitions are merged. Also verifies that
          // `subType === FLOW_DEFINITIONS_KEY` in the parse callback actually
          // gates the seenFullNames population.
          work.changes.add(ChangeKind.Modify, TRANSLATION_TYPE, FR)
          work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
          mockedPathExists.mockResolvedValue(true as never)
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><customFieldTranslations><name>CF__c</name><label>Custom</label></customFieldTranslations><flowDefinitions><fullName>TestA</fullName></flowDefinitions></Translations>`
          )
        })
        it('preserves the customFieldTranslations sibling AND merges new flowDefinitions', async () => {
          // Act
          const result = await sut.transformAndCollect()

          // Assert
          expect(result.copies).toHaveLength(1)
          const copy = result.copies[0]
          if (copy.kind === CopyOperationKind.StreamedContent) {
            const output = await drainWriter(copy.writer)
            expect(output).toContain('<name>CF__c</name>')
            expect(output).toContain('<label>Custom</label>')
            expect(output).toContain('test-flow')
            expect(output).toContain('TestA')
          }
        })
      })

      describe('when the output translation has a flowDefinition whose fullName matches the new one', () => {
        beforeEach(() => {
          work.changes.add(ChangeKind.Modify, TRANSLATION_TYPE, FR)
          work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
          mockedPathExists.mockResolvedValue(true as never)
          // Output already has `<fullName>test-flow</fullName>` — the new
          // flow with the same fullName must NOT duplicate (output-wins).
          mockedReadFile.mockResolvedValue(
            `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>${flowFullName}</fullName><label>OldLabel</label></flowDefinitions></Translations>`
          )
        })
        it('does not duplicate the flow and keeps the output-side content (output-wins-on-conflict)', async () => {
          // Act
          const result = await sut.transformAndCollect()
          const copy = result.copies[0]

          // Assert
          if (copy.kind === CopyOperationKind.StreamedContent) {
            const output = await drainWriter(copy.writer)
            // exactly one occurrence of the fullName
            const matches = output.match(
              new RegExp(`<fullName>${flowFullName}</fullName>`, 'g')
            )
            expect(matches).toHaveLength(1)
            expect(output).toContain('<label>OldLabel</label>')
          }
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
          expect(mockedReadPathFromGit).toHaveBeenCalled()
          expect(result.copies).toHaveLength(1)
          const copy = result.copies[0]
          expect(copy.kind).toBe(CopyOperationKind.StreamedContent)
          expect(copy.path).toBe(translationPath)
          if (copy.kind === CopyOperationKind.StreamedContent) {
            const output = await drainWriter(copy.writer)
            expect(output).toContain('test-flow')
            expect(output).toContain('TestA')
            expect(output).toContain('TestB')
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
          expect(mockedReadPathFromGit).toHaveBeenCalled()
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
            mockedReadPathFromGit.mockResolvedValue(
              translationXml([{ fullName: 'wrong' }])
            )
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
            expect(mockedReadPathFromGit).toHaveBeenCalledTimes(2)
            expect(result.copies).toHaveLength(0)
          })
        })

        describe('when there is flow matching the translation', () => {
          describe.each<boolean>([
            true,
            false,
          ])('when config.generateDelta is %s', generateDelta => {
            beforeEach(() => {
              mockedReadPathFromGit.mockResolvedValue(
                translationXml([
                  { fullName: flowFullName },
                  { fullName: 'otherFlow' },
                ])
              )
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
              expect(mockedReadPathFromGit).toHaveBeenCalledTimes(2)
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
          expect(mockedReadPathFromGit).not.toHaveBeenCalled()
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
          expect(mockedReadPathFromGit).toHaveBeenCalledTimes(1)
          expect(result.copies).toHaveLength(1)
        })
      })

      describe('when the translation file is subDir of output', () => {
        beforeEach(() => {
          // Arrange
          const out = 'out'
          work.config.output = out
          mockedReadPathFromGit.mockResolvedValue(emptyTranslationXml)
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
          expect(mockedReadPathFromGit).not.toHaveBeenCalled()
          expect(result.copies).toHaveLength(0)
        })
      })
    })
  })
})
