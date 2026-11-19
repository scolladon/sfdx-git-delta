'use strict'
import { PassThrough } from 'node:stream'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  getDefinition,
  getInFileAttributes,
} from '../../../src/metadata/metadataManager'
import type { SharedFileMetadata } from '../../../src/types/metadata'
import type { Work } from '../../../src/types/work'
import { readPathFromGit } from '../../../src/utils/fsHelper'
import {
  RecordedChildren,
  RecordingChildParser,
  ReusingChildParser,
} from '../../../src/utils/metadataDiff/childReuse.js'
import MetadataDiff from '../../../src/utils/metadataDiff/index.js'
import { StreamingDiff } from '../../../src/utils/metadataDiff/streamingDiff.js'
import {
  parseFromSideSwallowing,
  parseToSidePropagating,
} from '../../../src/utils/metadataDiff/xmlEventReader.js'
import { getWork } from '../../__utils__/testWork'
import { listFixtures } from './byteEqualityFixtures'

vi.mock('../../../src/utils/fsHelper', async () => {
  const actual: typeof import('../../../src/utils/fsHelper') =
    await vi.importActual('../../../src/utils/fsHelper')
  return {
    ...actual,
    readPathFromGit: vi.fn(),
  }
})

const mockedReadPathFromGit = vi.mocked(readPathFromGit)

const PRNG_SEED = 20_241_119
const PRNG_MULTIPLIER = 1_664_525
const PRNG_INCREMENT = 1_013_904_223
const PRNG_MODULUS = 2 ** 32
const PROFILE_CHILD_COUNT = 3_000
const LABEL_CHILD_COUNT = 3_000
const SAME_ORDER_EDIT_COUNT = 5
const EDIT_STEP = 601
const DELETE_RATIO = 0.4
const MODIFY_RATIO = 0.3
const INSERT_RATIO = 0.2
const DUPLICATE_RATIO = 0.1
const MIN_REUSED_RATIO = 0.9
const SPACES = { child: '    ', inner: '      ' } as const
const TABS = { child: '\t', inner: '\t\t' } as const

type Indent = { child: string; inner: string }
type Child = { tag: string; keyTag: string; id: number; variant: number }
type Rewrite = (children: Child[], random: () => number) => Child[]
type Document = { name: string; root: string; children: Child[] }
type Case = {
  name: string
  fromXml: string
  toXml: string
  generateDelta: boolean
}

const createRandom = (): (() => number) => {
  let state = PRNG_SEED
  return () => {
    state = (state * PRNG_MULTIPLIER + PRNG_INCREMENT) % PRNG_MODULUS
    return state / PRNG_MODULUS
  }
}

const render = (child: Child, indent: Indent): string =>
  [
    `${indent.child}<${child.tag}>`,
    `${indent.inner}<value>v${child.variant}</value>`,
    `${indent.inner}<${child.keyTag}>${child.tag}_${child.id}</${child.keyTag}>`,
    `${indent.child}</${child.tag}>`,
  ].join('\n')

const documentXml = (
  root: string,
  children: readonly Child[],
  indent: Indent
): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<${root} xmlns="http://soap.sforce.com/2006/04/metadata">\n${children.map(child => render(child, indent)).join('\n')}\n</${root}>\n`

const PROFILE_KINDS = [
  { tag: 'fieldPermissions', keyTag: 'field' },
  { tag: 'layoutAssignments', keyTag: 'layout' },
  { tag: 'loginIpRanges', keyTag: 'startAddress' },
  { tag: 'valueTranslation', keyTag: 'masterLabel' },
  { tag: 'userLicense', keyTag: 'name' },
  { tag: 'description', keyTag: 'text' },
] as const

const generateChildren = (
  count: number,
  kinds: readonly { tag: string; keyTag: string }[]
): Child[] =>
  Array.from({ length: count }, (_, id) => ({
    ...(kinds[id % kinds.length] as { tag: string; keyTag: string }),
    id,
    variant: 0,
  }))

const modified = (child: Child): Child => ({
  ...child,
  variant: child.variant + 1,
})

const pickWithRatio = (
  children: Child[],
  random: () => number,
  ratio: number
): boolean[] => children.map(() => random() < ratio)

const deleteSome: Rewrite = (children, random) => {
  const dropped = pickWithRatio(children, random, DELETE_RATIO)
  return children.filter((_, i) => !dropped[i])
}

const modifySome: Rewrite = (children, random) => {
  const edited = pickWithRatio(children, random, MODIFY_RATIO)
  return children.map((child, i) => (edited[i] ? modified(child) : child))
}

const insertSome: Rewrite = (children, random) =>
  children.flatMap(child =>
    random() < INSERT_RATIO
      ? [{ ...child, id: children.length + child.id, variant: 0 }, child]
      : [child]
  )

const duplicateSome: Rewrite = (children, random) =>
  children.flatMap(child =>
    random() < DUPLICATE_RATIO ? [child, child] : [child]
  )

const moveFirstThirdToEnd: Rewrite = children => {
  const third = Math.floor(children.length / 3)
  return [...children.slice(third), ...children.slice(0, third)]
}

const shuffle: Rewrite = (children, random) => {
  const result = [...children]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j] as Child, result[i] as Child]
  }
  return result
}

const editFive: Rewrite = children =>
  children.map((child, i) =>
    i % EDIT_STEP === 0 && i / EDIT_STEP < SAME_ORDER_EDIT_COUNT
      ? modified(child)
      : child
  )

const sequence =
  (...steps: Rewrite[]): Rewrite =>
  (children, random) =>
    steps.reduce((current, step) => step(current, random), children)

const REWRITES: ReadonlyArray<{
  name: string
  rewrite: Rewrite
  indent: Indent
}> = [
  { name: 'same order with 5 edits', rewrite: editFive, indent: SPACES },
  {
    name: 'first third moved to the end',
    rewrite: moveFirstThirdToEnd,
    indent: SPACES,
  },
  { name: 'reversed', rewrite: c => [...c].reverse(), indent: SPACES },
  { name: 'shuffled', rewrite: shuffle, indent: SPACES },
  { name: '40% deleted', rewrite: deleteSome, indent: SPACES },
  { name: '30% modified', rewrite: modifySome, indent: SPACES },
  { name: '20% new children inserted', rewrite: insertSome, indent: SPACES },
  { name: '10% duplicated', rewrite: duplicateSome, indent: SPACES },
  { name: 'tab-indented', rewrite: c => c, indent: TABS },
  {
    name: 'every child modified',
    rewrite: c => c.map(modified),
    indent: SPACES,
  },
  {
    name: 'all combined',
    rewrite: sequence(
      moveFirstThirdToEnd,
      deleteSome,
      modifySome,
      insertSome,
      duplicateSome,
      shuffle
    ),
    indent: TABS,
  },
]

const DOCUMENTS: readonly Document[] = [
  {
    name: 'Profile-like',
    root: 'Profile',
    children: generateChildren(PROFILE_CHILD_COUNT, PROFILE_KINDS),
  },
  {
    name: 'CustomLabels-like',
    root: 'CustomLabels',
    children: generateChildren(LABEL_CHILD_COUNT, [
      { tag: 'labels', keyTag: 'fullName' },
    ]),
  },
]

const GENERATE_DELTA_MODES = [true, false] as const

const generatedCases = (): Case[] =>
  DOCUMENTS.flatMap(document =>
    REWRITES.flatMap(({ name, rewrite, indent }) =>
      GENERATE_DELTA_MODES.map(generateDelta => ({
        name: `${document.name} ${name} generateDelta ${generateDelta}`,
        fromXml: documentXml(document.root, document.children, SPACES),
        toXml: documentXml(
          document.root,
          rewrite(document.children, createRandom()),
          indent
        ),
        generateDelta,
      }))
    )
  )

const fixtureCases = (): Case[] =>
  listFixtures().flatMap(fixture =>
    GENERATE_DELTA_MODES.map(generateDelta => ({
      name: `fixture ${fixture.name} generateDelta ${generateDelta}`,
      fromXml: fixture.fromXml,
      toXml: fixture.toXml,
      generateDelta,
    }))
  )

type Writer = (out: PassThrough) => Promise<void>

const renderedBytes = async (
  writer: Writer | undefined
): Promise<string | null> => {
  if (!writer) return null
  const chunks: Buffer[] = []
  const stream = new PassThrough()
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
  await writer(stream)
  stream.end()
  return Buffer.concat(chunks).toString('utf8')
}

type Outcome = {
  added: unknown
  modified: unknown
  deleted: unknown
  hasPackageContent: boolean
  rendered: string | null
}

describe('childReuseParity', () => {
  let inFileAttributes: Map<string, SharedFileMetadata>
  let work: Work

  beforeAll(async () => {
    work = getWork()
    work.config.to = 'to-ref'
    work.config.from = 'from-ref'
    inFileAttributes = getInFileAttributes(await getDefinition({}))
  })

  const withReuse = async (testCase: Case): Promise<Outcome> => {
    mockedReadPathFromGit.mockImplementation(async ref =>
      ref.oid === work.config.to ? testCase.toXml : testCase.fromXml
    )
    const sut = new MetadataDiff(
      { ...work.config, generateDelta: testCase.generateDelta },
      inFileAttributes
    )
    const outcome = await sut.run('file/path')
    return {
      added: outcome.manifests.added,
      modified: outcome.manifests.modified,
      deleted: outcome.manifests.deleted,
      hasPackageContent: outcome.hasPackageContent,
      rendered: await renderedBytes(outcome.writer),
    }
  }

  const withoutReuse = async (testCase: Case): Promise<Outcome> => {
    const engine = new StreamingDiff(inFileAttributes, testCase.generateDelta)
    await parseFromSideSwallowing(testCase.fromXml, engine.onFromElement)
    const rootCapture = testCase.toXml
      ? await parseToSidePropagating(testCase.toXml, engine.onToElement)
      : null
    const outcome = engine.finalize()
    return {
      added: outcome.added,
      modified: outcome.modified,
      deleted: outcome.deleted,
      hasPackageContent: outcome.hasPackageContent,
      rendered: await renderedBytes(engine.buildWriter(rootCapture)),
    }
  }

  const cases = [...fixtureCases(), ...generatedCases()]

  it('Given the corpora, When the case table is built, Then fixtures and generated documents are all present', () => {
    // Arrange
    const expectedGenerated =
      DOCUMENTS.length * REWRITES.length * GENERATE_DELTA_MODES.length

    // Act
    const result = {
      fixtures: fixtureCases().length,
      generated: generatedCases().length,
    }

    // Assert
    expect(result.fixtures).toBeGreaterThan(0)
    expect(result.generated).toBe(expectedGenerated)
  })

  it.each(cases)(
    'Given $name, When run executes with and without child reuse, Then outcomes and rendered bytes are equal',
    async (testCase: Case) => {
      // Arrange
      const expected = await withoutReuse(testCase)

      // Act
      const result = await withReuse(testCase)

      // Assert
      expect(result).toEqual(expected)
    }
  )

  it.each(DOCUMENTS)(
    'Given a $name document with identical order, When the to side is parsed with reuse, Then most children are the recorded objects',
    async (document: Document) => {
      // Arrange
      const recorded = new RecordedChildren()
      const fromElements = new Set<unknown>()
      const toElements: unknown[] = []
      const toXml = documentXml(
        document.root,
        editFive(document.children, createRandom()),
        SPACES
      )
      await parseFromSideSwallowing(
        documentXml(document.root, document.children, SPACES),
        (_, element) => fromElements.add(element),
        new RecordingChildParser(recorded)
      )

      // Act
      await parseToSidePropagating(
        toXml,
        (_, element) => toElements.push(element),
        new ReusingChildParser(recorded)
      )

      // Assert
      const reused = toElements.filter(element => fromElements.has(element))
      expect(reused.length).toBeGreaterThan(
        document.children.length * MIN_REUSED_RATIO
      )
    }
  )
})
