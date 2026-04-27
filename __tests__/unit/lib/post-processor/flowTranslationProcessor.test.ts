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
  result.changes.toElements().some(m => m.type === TRANSLATION_TYPE)

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

  describe('XML structure constants (kills StringLiteral / ObjectLiteral mutations on L37-42, L66)', () => {
    beforeEach(() => {
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockIgnores.mockReturnValue(false)
      mockedIsSubDir.mockReturnValue(false)
      work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
      mockedGrepContent.mockResolvedValue([
        `${FR}.translation${METAFILE_SUFFIX}`,
      ])
      mockedReadPathFromGit.mockResolvedValue(
        translationXml([{ fullName: flowFullName }])
      )
      // output file does not exist: pathExists returns false
      mockedPathExists.mockResolvedValue(false as never)
    })

    it('When writer emits XML, Then root element is <Translations> with xmlns namespace', async () => {
      // Act
      const sut = new FlowTranslationProcessor(work, metadata)
      const result = await sut.transformAndCollect()
      const copy = result.copies[0]
      if (copy.kind !== CopyOperationKind.StreamedContent) {
        throw new Error('Expected StreamedContent')
      }
      const output = await drainWriter(copy.writer)

      // Assert — kills TRANSLATIONS_ROOT_KEY='', TRANSLATIONS_NAMESPACE=''
      expect(output).toContain('<Translations')
      expect(output).toContain('http://soap.sforce.com/2006/04/metadata')
    })

    it('When writer emits XML, Then XML declaration header is present', async () => {
      // Act
      const sut = new FlowTranslationProcessor(work, metadata)
      const result = await sut.transformAndCollect()
      const copy = result.copies[0]
      if (copy.kind !== CopyOperationKind.StreamedContent) {
        throw new Error('Expected StreamedContent')
      }
      const output = await drainWriter(copy.writer)

      // Assert — kills DEFAULT_XML_HEADER={}, version/encoding StringLiterals
      expect(output).toContain('<?xml')
      expect(output).toContain('1.0')
      expect(output).toContain('UTF-8')
    })

    it('When writer emits XML, Then flowDefinitions element contains the flow fullName', async () => {
      // Act
      const sut = new FlowTranslationProcessor(work, metadata)
      const result = await sut.transformAndCollect()
      const copy = result.copies[0]
      if (copy.kind !== CopyOperationKind.StreamedContent) {
        throw new Error('Expected StreamedContent')
      }
      const output = await drainWriter(copy.writer)

      // Assert — kills getTranslationName ArrowFunction → undefined
      expect(result.changes.toElements()[0].member).toBe(FR)
      expect(output).toContain(flowFullName)
    })
  })

  describe('_initIgnoreHelper idempotence (kills L149 ConditionalExpression false)', () => {
    it('Given _initIgnoreHelper is called twice, Then buildIgnoreHelper is invoked only once', async () => {
      // Arrange
      const { buildIgnoreHelper } = await import(
        '../../../../src/utils/ignoreHelper'
      )
      const mockedBuildIgnoreHelper = vi.mocked(buildIgnoreHelper)
      work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)

      // Act — call twice
      await (sut as any)._initIgnoreHelper()
      await (sut as any)._initIgnoreHelper()

      // Assert
      expect(mockedBuildIgnoreHelper).toHaveBeenCalledTimes(1)
    })
  })

  describe('_mergeTranslationWithOutput when output has no flowDefinitions element (kills L278/L280 ConditionalExpression false)', () => {
    beforeEach(() => {
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockIgnores.mockReturnValue(false)
      mockedIsSubDir.mockReturnValue(false)
      work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
      mockedGrepContent.mockResolvedValue([
        `${FR}.translation${METAFILE_SUFFIX}`,
      ])
      mockedReadPathFromGit.mockResolvedValue(
        translationXml([{ fullName: flowFullName }])
      )
      mockedPathExists.mockResolvedValue(true as never)
      // Output XML has no flowDefinitions — only a sibling element
      mockedReadFile.mockResolvedValue(
        `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><customFieldTranslations><name>CF__c</name></customFieldTranslations></Translations>`
      )
    })

    it('Then new flow is appended and sibling is preserved', async () => {
      // Act
      const sut = new FlowTranslationProcessor(work, metadata)
      const result = await sut.transformAndCollect()
      const copy = result.copies[0]
      if (copy.kind !== CopyOperationKind.StreamedContent) {
        throw new Error('Expected StreamedContent')
      }
      const output = await drainWriter(copy.writer)

      // Assert
      expect(output).toContain(flowFullName)
      expect(output).toContain('<name>CF__c</name>')
    })
  })

  describe('_addFlowPerTranslation list initialisation (kills L295 ConditionalExpression true)', () => {
    it('Given two flows for the same translation, When _addFlowPerTranslation is called, Then both are stored', () => {
      // Arrange
      work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)
      const path = `${FR}.translation${METAFILE_SUFFIX}`

      // Act
      ;(sut as any)._addFlowPerTranslation({
        translationPath: path,
        flowDefinition: { fullName: 'FlowA' },
      })
      ;(sut as any)._addFlowPerTranslation({
        translationPath: path,
        flowDefinition: { fullName: 'FlowB' },
      })

      // Assert — kills "list = undefined → []" branch flip
      expect((sut as any).translations.get(path)).toHaveLength(2)
    })
  })

  describe('_mergeActualFlows deduplication (kills L223/L217 ConditionalExpression)', () => {
    it('Given a flow already in seenFullNames, When _mergeActualFlows is called, Then it is not duplicated', () => {
      // Arrange
      work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)
      const seenFullNames = new Set<string | undefined>(['existing'])
      const bucket: Array<{ fullName?: string }> = [{ fullName: 'existing' }]
      const merge = {
        rootCapture: {} as any,
        orderedChildren: [['flowDefinitions', bucket]] as Array<
          [string, unknown[]]
        >,
        flowsIndex: 0,
        seenFullNames,
      }

      // Act
      ;(sut as any)._mergeActualFlows(merge, [
        { fullName: 'existing' },
        { fullName: 'new-flow' },
      ])

      // Assert — kills ConditionalExpression true on seenFullNames.has
      expect(bucket).toHaveLength(2) // original + new-flow only
      expect(bucket.map((f: any) => f.fullName)).toContain('new-flow')
      expect(bucket.filter((f: any) => f.fullName === 'existing')).toHaveLength(
        1
      )
    })

    it('Given seenFullNames.add is called after push (kills L229 ConditionalExpression true)', () => {
      // Arrange
      work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)
      const seenFullNames = new Set<string | undefined>()
      const bucket: Array<{ fullName?: string }> = []
      const merge = {
        rootCapture: {} as any,
        orderedChildren: [['flowDefinitions', bucket]] as Array<
          [string, unknown[]]
        >,
        flowsIndex: 0,
        seenFullNames,
      }

      // Act — call with two identical flows
      ;(sut as any)._mergeActualFlows(merge, [
        { fullName: 'dup' },
        { fullName: 'dup' },
      ])

      // Assert — second dup must be skipped because seenFullNames is updated after first push
      expect(bucket).toHaveLength(1)
    })
  })

  describe('_mergeTranslationWithOutput capture null path (kills L224 ConditionalExpression false)', () => {
    beforeEach(() => {
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockIgnores.mockReturnValue(false)
      mockedIsSubDir.mockReturnValue(false)
      work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
      mockedGrepContent.mockResolvedValue([
        `${FR}.translation${METAFILE_SUFFIX}`,
      ])
      mockedReadPathFromGit.mockResolvedValue(
        translationXml([{ fullName: flowFullName }])
      )
      mockedPathExists.mockResolvedValue(true as never)
      // Invalid XML causes parseFromSideSwallowing to return null
      mockedReadFile.mockResolvedValue('not valid xml at all ###')
    })

    it('When output XML is unparseable, Then falls back to empty merge and still produces copy', async () => {
      // Act
      const sut = new FlowTranslationProcessor(work, metadata)
      const result = await sut.transformAndCollect()

      // Assert — kills ConditionalExpression false that skips emptyTranslationMerge() fallback
      expect(result.copies).toHaveLength(1)
      const copy = result.copies[0]
      if (copy.kind === CopyOperationKind.StreamedContent) {
        const output = await drainWriter(copy.writer)
        expect(output).toContain(flowFullName)
      }
    })
  })

  describe('ArrayDeclaration mutations: no stray Stryker entries in output (L75, L209, L217, L228)', () => {
    beforeEach(() => {
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockIgnores.mockReturnValue(false)
      mockedIsSubDir.mockReturnValue(false)
      work.changes.add(ChangeKind.Modify, FLOW_XML_NAME, flowFullName)
      mockedGrepContent.mockResolvedValue([
        `${FR}.translation${METAFILE_SUFFIX}`,
      ])
      mockedReadPathFromGit.mockResolvedValue(
        translationXml([{ fullName: flowFullName }])
      )
      mockedPathExists.mockResolvedValue(false as never)
    })

    it('When XML is produced, Then does not contain "Stryker was here" (kills L75/L209/L217/L228 ArrayDeclaration mutations)', async () => {
      // Any ArrayDeclaration mutation that inserts "Stryker was here" into
      // orderedChildren or the translations list would cause the XML serializer
      // to emit that string in the output. This strict negative assertion kills them.
      const sut = new FlowTranslationProcessor(work, metadata)
      const result = await sut.transformAndCollect()
      const copy = result.copies[0]
      if (copy.kind !== CopyOperationKind.StreamedContent) {
        throw new Error('Expected StreamedContent')
      }
      const output = await drainWriter(copy.writer)

      expect(output).not.toContain('Stryker was here')
      expect(output).toContain(flowFullName)
    })

    it('When _addFlowPerTranslation is called for existing key, Then list size grows by 1 (not 2 from stray entry)', () => {
      // L209 mutant: list = ["Stryker was here"] → list starts with 1 stray entry
      // Then list.push(flowDef) makes it 2 elements. After calling twice: 3 elements.
      // Real: list=[], push → 1 element; second push → 2 elements.
      work = getWork()
      const sut = new FlowTranslationProcessor(work, metadata)
      const path = `${FR}.translation${METAFILE_SUFFIX}`

      // First call creates the list
      ;(sut as any)._addFlowPerTranslation({
        translationPath: path,
        flowDefinition: { fullName: 'FlowA' },
      })

      // Assert: exactly 1 element (no stray entry from mutant)
      expect((sut as any).translations.get(path)).toHaveLength(1)
      expect((sut as any).translations.get(path)[0]).toMatchObject({
        fullName: 'FlowA',
      })
    })

    it('When _mergeTranslationWithOutput finds no flowDefinitions in output, Then new bucket has 0 elements before merge (kills L228)', async () => {
      // L228 mutant: orderedChildren.push([FLOW_DEFINITIONS_KEY, ["Stryker was here"]])
      // → bucket starts with 1 element. After merge the bucket would have stray+actual.
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockedPathExists.mockResolvedValue(true as never)
      // Output XML has no flowDefinitions
      mockedReadFile.mockResolvedValue(
        `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"></Translations>`
      )
      const sut = new FlowTranslationProcessor(work, metadata)
      const merge = await (sut as any)._mergeTranslationWithOutput(
        `${FR}.translation${METAFILE_SUFFIX}`
      )

      // The flowDefinitions bucket must be empty before _mergeActualFlows
      const bucket = merge.orderedChildren[merge.flowsIndex][1]
      expect(bucket).toHaveLength(0)
    })

    it('When emptyTranslationMerge is used, Then flowDefinitions bucket starts empty (kills L75)', () => {
      // L75 mutant: orderedChildren: [[FLOW_DEFINITIONS_KEY, ["Stryker was here"]]]
      // The bucket starts with 1 stray entry instead of [].
      const sut = new FlowTranslationProcessor(getWork(), metadata)
      const merge = (sut as any).constructor // access via prototype
      // Call emptyTranslationMerge indirectly via _mergeTranslationWithOutput
      // when output does not exist
      work = getWork()
      work.config.output = 'output'
      mockedPathExists.mockResolvedValue(false as never)
      const sut2 = new FlowTranslationProcessor(work, metadata)
      return (sut2 as any)
        ._mergeTranslationWithOutput(`${FR}.translation${METAFILE_SUFFIX}`)
        .then((m: any) => {
          const bucket = m.orderedChildren[m.flowsIndex][1]
          expect(bucket).toHaveLength(0)
        })
    })
  })

  describe('L214 ConditionalExpression true mutation (_mergeTranslationWithOutput idx init)', () => {
    it('When output has multiple siblings of same type, Then each type gets its own bucket (L214 true would duplicate)', async () => {
      // L214 mutant: if (true) → idx always undefined → new bucket created for every element
      // This means two <flowDefinitions> elements each get separate buckets instead of sharing one.
      // The orderedChildren would have 2 flowDefinitions entries instead of 1.
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockedPathExists.mockResolvedValue(true as never)
      mockedReadFile.mockResolvedValue(
        `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>A</fullName></flowDefinitions><flowDefinitions><fullName>B</fullName></flowDefinitions></Translations>`
      )
      const sut = new FlowTranslationProcessor(work, metadata)
      const merge = await (sut as any)._mergeTranslationWithOutput(
        `${FR}.translation${METAFILE_SUFFIX}`
      )

      // With real code: both flowDefinitions elements share the same bucket → 2 elements in 1 bucket
      // With mutant: 2 separate buckets each with 1 element → orderedChildren has 2 entries
      const flowsCount = (merge.orderedChildren as Array<[string, unknown[]]>)
        .filter(([key]: [string, unknown[]]) => key === 'flowDefinitions')
        .reduce(
          (sum: number, [, arr]: [string, unknown[]]) => sum + arr.length,
          0
        )
      expect(flowsCount).toBe(2)
    })
  })

  describe('L220 ConditionalExpression true mutation (seenFullNames population)', () => {
    it('When non-flowDefinitions sibling is parsed, Then seenFullNames does NOT include its fullName (L220 true would add all siblings)', async () => {
      // L220 mutant: if (true) instead of if (subType === FLOW_DEFINITIONS_KEY)
      // → seenFullNames gets populated for ALL sibling types, including customFieldTranslations
      // → when we try to merge a new flow, if customFieldTranslation.fullName matches a flow fullName,
      //   the merge would skip the new flow (incorrectly). We detect via seenFullNames size.
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockedPathExists.mockResolvedValue(true as never)
      mockedReadFile.mockResolvedValue(
        `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><customFieldTranslations><fullName>SomeField</fullName></customFieldTranslations><flowDefinitions><fullName>MyFlow</fullName></flowDefinitions></Translations>`
      )
      const sut = new FlowTranslationProcessor(work, metadata)
      const merge = await (sut as any)._mergeTranslationWithOutput(
        `${FR}.translation${METAFILE_SUFFIX}`
      )

      // Real: seenFullNames only has 'MyFlow' (from flowDefinitions)
      // Mutant true: seenFullNames has both 'SomeField' and 'MyFlow'
      expect(merge.seenFullNames).toContain('MyFlow')
      expect(merge.seenFullNames).not.toContain('SomeField')
    })
  })

  describe('L226 ConditionalExpression true mutation (flowsIndex undefined check)', () => {
    it('When output flowDefinitions already exists, Then flowsIndex uses existing index not new bucket (L226 true always creates new)', async () => {
      // L226 mutant: if (true) → always pushes a new flowDefinitions bucket
      // even when one already exists. This means orderedChildren gets 2 flowDefinitions buckets.
      // We detect by checking the number of flowDefinitions entries.
      work = getWork()
      work.config.output = 'output'
      work.config.repo = './'
      mockedPathExists.mockResolvedValue(true as never)
      mockedReadFile.mockResolvedValue(
        `<?xml version="1.0" encoding="UTF-8"?><Translations xmlns="http://soap.sforce.com/2006/04/metadata"><flowDefinitions><fullName>Existing</fullName></flowDefinitions></Translations>`
      )
      const sut = new FlowTranslationProcessor(work, metadata)
      const merge = await (sut as any)._mergeTranslationWithOutput(
        `${FR}.translation${METAFILE_SUFFIX}`
      )

      // Only one flowDefinitions bucket must exist
      const flowsBuckets = (
        merge.orderedChildren as Array<[string, unknown[]]>
      ).filter(([key]: [string, unknown[]]) => key === 'flowDefinitions')
      expect(flowsBuckets).toHaveLength(1)
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
              expect(result.changes.toElements()).toEqual(
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
