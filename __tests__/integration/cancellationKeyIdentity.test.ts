'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { EMPTY_TREE_READER } from '../../src/adapter/treeReader'
import { TAB } from '../../src/constant/cliConstants'
import { ADDITION } from '../../src/constant/gitConstants'
import {
  INFOLDER_SUFFIX,
  METAFILE_SUFFIX,
} from '../../src/constant/metadataConstants'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository'
import { getDefinition } from '../../src/metadata/metadataManager'
import TypeHandlerFactory from '../../src/service/typeHandlerFactory'
import type { Metadata } from '../../src/types/metadata'
import RepoGitDiff from '../../src/utils/repoGitDiff'
import { getConfig } from '../__utils__/testWork'

// The deleted-renamed cancellation index compares components by the key
// RepoGitDiff derives from a diff line. That key is path-derived and
// synchronous; the authority on what component a path really is remains
// TypeHandlerFactory + getElementDescriptor(), which is async and builds a
// handler per call. This file pins the two together: the partition the key
// induces over a corpus of paths must be exactly the partition the descriptor
// induces. Same component => same key (no split), different component =>
// different key (no collision).
//
// The corpus is generated from the registry rather than hand-picked. Every
// family a hand-picked list happened to omit turned out to hide a defect, so
// the omission itself was the bug: a registry entry growing a new shape must
// arrive here on its own. The equivalence is therefore stated with its
// deviations, declared below as named exclusions carrying their reason — never
// by leaving a family out of the corpus.
//
// Both sides are compared lowercased because sgd treats Salesforce API names
// as case-insensitive: RepoGitDiff lowercases the key so a case-only rename
// cancels, and the descriptor has to be read under the same rule.

// One component the key answers for under more than one name.
// Keyed by the xmlName the descriptor reports.
const KNOWN_SPLITS: ReadonlyMap<string, string> = new Map([
  [
    'IntegrationHubSettingsType',
    'two registry entries share the `integrationHub` directory under different suffixes, so the directory walk answers with this one type for both spellings while the key, which keeps the suffix, tells them apart. Here the descriptor is the imprecise side, not the key.',
  ],
  [
    'WaveTemplateBundle',
    'declared twice: as an SDR `bundle` under `waveTemplates/` and as a `wave/*.wtemplate` entry of the internal registry. The two layouts sit in different type directories and a path-derived key cannot bridge directories.',
  ],
])

// Distinct components the key answers for under one name. Keyed by the xmlNames
// sharing it, so the entry names every participant. Anything landing here must
// carry the reason no path-derived key can tell those types apart.
const KNOWN_COLLISIONS: ReadonlyMap<string, string> = new Map()

// Two types declaring one suffix under different directories is the shape that
// let distinct components meet on one key. These five suffixes were the live
// groups when the type directory entered the key; they are a floor on what the
// guard below runs over, never the list it is built from — the groups
// themselves are read off the registry.
const ONCE_COLLIDING_SUFFIXES = [
  'dataSource',
  'policy',
  'rule',
  'settings',
  'site',
] as const
const SHARED_SUFFIX_NAME = 'Shared'

const SOURCE = 'force-app/main/default'
const NAMES = ['Alpha', 'Beta'] as const
const SUB_FOLDER = 'Grp'
const DIGITAL_EXPERIENCE_ADAPTER = 'digitalExperience'
const PERMISSION_SET_XML_NAME = 'PermissionSet'
const CUSTOM_OBJECT_TRANSLATION_XML_NAME = 'CustomObjectTranslation'
// Deliberately not imported from src's HOLDER_SCOPED_COMPOSED_TYPES: reading
// the rule's own list here would make this file agree with the rule by
// construction instead of standing as independent evidence for it.
const HOLDER_SCOPED_XML_NAMES = new Set([
  PERMISSION_SET_XML_NAME,
  CUSTOM_OBJECT_TRANSLATION_XML_NAME,
])
const DECOMPOSED_ADAPTER = 'decomposed'
const MIXED_CONTENT_ADAPTER = 'mixedContent'
const CONTAINER_ADAPTERS = new Set(['bundle', MIXED_CONTENT_ADAPTER])
const CONTAINER_CONTENT_EXTENSION = 'js'
const ARBITRARY_CONTENT_EXTENSIONS = ['png', 'jpg']
// A floor, not a target. Only a component spelled more than one way can split,
// so this is the population the split proof below actually runs on: a generator
// that stopped emitting companion spellings would leave that proof vacuously
// true, and this is what says it did not.
const MIN_MULTI_PATH_COMPONENTS = 100

// `id` is the descriptor read case-insensitively — the component itself.
type Component = {
  readonly id: string
  readonly type: string
  readonly paths: readonly string[]
}

// The paths a registry entry can appear under, derived from the entry alone.
// Each returned group is one component, spelled every way that entry allows:
//   - no `directoryName`: an in-file child, it owns no path of its own
//   - `digitalExperience`: SDR's canonical bundle and content depths
//   - `inFolder`: `<folder>/<name>`, plus the folder's own file; a mixedContent
//     one (Document) also carries arbitrary content extensions
//   - `bundle` / `mixedContent`: a directory of opaque content, optionally
//     named by a file sitting directly under the type directory
//   - `decomposed`: the `-meta.xml` is the whole file, it has no companion
//   - `content[]`: one flat directory shared by suffix-keyed sub-types, which a
//     repository may still nest under a sub-directory of its own
//   - anything else: one file, plus its content companion when `metaFile`
const pathsFor = (meta: Metadata): string[][] => {
  const directory = meta.directoryName
  if (!directory) return []
  const base = `${SOURCE}/${directory}`
  const contentSuffixes = (meta.content ?? [])
    .map(entry => entry.suffix)
    .filter((suffix): suffix is string => Boolean(suffix))
  const spellings = (path: string) =>
    meta.metaFile
      ? [path, `${path}${METAFILE_SUFFIX}`]
      : [`${path}${METAFILE_SUFFIX}`]

  // Checked before the DECOMPOSED_ADAPTER branch and the generic tail: a
  // decomposed holder's own file and its decomposed children are one
  // component, spelled every way a repository lays it out. The flat
  // `objectTranslations/<name>.objectTranslation-meta.xml` layout is
  // deliberately not emitted here — its descriptor answers a garbage member
  // (`CustomObjectTranslation/<name>.objectTranslation-meta.xml`) because
  // that layout is unsupported by SFDX. The key is right for that path; only
  // the descriptor is not, so this generator does not compare them. See
  // "Given the unsupported flat CustomObjectTranslation layout" below.
  if (HOLDER_SCOPED_XML_NAMES.has(meta.xmlName!)) {
    return meta.xmlName === PERMISSION_SET_XML_NAME
      ? NAMES.map(name => [
          `${base}/${name}.permissionset${METAFILE_SUFFIX}`,
          `${base}/${name}/${name}.permissionset${METAFILE_SUFFIX}`,
          `${base}/${name}/objectSettings/Account.objectSettings${METAFILE_SUFFIX}`,
        ])
      : NAMES.map(name => [
          `${base}/${name}/${name}.objectTranslation${METAFILE_SUFFIX}`,
          `${base}/${name}/Account.fieldTranslation${METAFILE_SUFFIX}`,
        ])
  }

  if (meta.adapter === DIGITAL_EXPERIENCE_ADAPTER) {
    return NAMES.flatMap(name => [
      [
        `${base}/site/${name}.digitalExperience${METAFILE_SUFFIX}`,
        `${base}/site/${name}/${name}.digitalExperience${METAFILE_SUFFIX}`,
      ],
      [
        `${base}/site/${name}/sfdc_cms__view/home/content.json`,
        `${base}/site/${name}/sfdc_cms__view/home/_meta.json`,
      ],
    ])
  }

  if (meta.inFolder) {
    const items = (contentSuffixes.length ? contentSuffixes : [meta.suffix])
      .filter((suffix): suffix is string => Boolean(suffix))
      .filter(suffix => !suffix.endsWith(INFOLDER_SUFFIX))
    return [
      ...items.flatMap(suffix =>
        NAMES.map(name => spellings(`${base}/${SUB_FOLDER}/${name}.${suffix}`))
      ),
      ...contentSuffixes
        .filter(suffix => suffix.endsWith(INFOLDER_SUFFIX))
        .map(suffix => [`${base}/${SUB_FOLDER}.${suffix}${METAFILE_SUFFIX}`]),
      ...(meta.adapter === MIXED_CONTENT_ADAPTER
        ? NAMES.map(name =>
            ARBITRARY_CONTENT_EXTENSIONS.map(
              extension => `${base}/${SUB_FOLDER}/${name}.${extension}`
            )
          )
        : []),
    ]
  }

  if (meta.adapter && CONTAINER_ADAPTERS.has(meta.adapter)) {
    return NAMES.map(name => [
      `${base}/${name}/${name}.${meta.suffix ?? CONTAINER_CONTENT_EXTENSION}`,
      `${base}/${name}/sub/helper.${CONTAINER_CONTENT_EXTENSION}`,
      ...(meta.suffix
        ? [`${base}/${name}.${meta.suffix}${METAFILE_SUFFIX}`]
        : []),
    ])
  }

  if (meta.adapter === DECOMPOSED_ADAPTER) {
    return NAMES.map(name => [
      `${base}/${name}/${name}.${meta.suffix}${METAFILE_SUFFIX}`,
    ])
  }

  if (contentSuffixes.length) {
    return contentSuffixes.flatMap(suffix =>
      NAMES.map(name => [
        ...spellings(`${base}/${name}.${suffix}`),
        `${base}/${SUB_FOLDER}/${name}.${suffix}`,
      ])
    )
  }

  if (!meta.suffix) return []
  return NAMES.map(name => spellings(`${base}/${name}.${meta.suffix}`))
}

// Every suffix declared under more than one type directory, mapped to those
// directories. A family contributes the suffix it names itself and every suffix
// its `content[]` names, since both route a path to it.
const directoriesPerSharedSuffix = (
  families: readonly Metadata[]
): Map<string, string[]> => {
  const perSuffix = new Map<string, string[]>()
  for (const family of families) {
    const suffixes = [
      family.suffix,
      ...(family.content ?? []).map(c => c.suffix),
    ]
    for (const suffix of suffixes) {
      if (!suffix || !family.directoryName) continue
      const known = perSuffix.get(suffix) ?? []
      if (known.includes(family.directoryName)) continue
      perSuffix.set(suffix, [...known, family.directoryName])
    }
  }
  return new Map(
    [...perSuffix].filter(([, directories]) => directories.length > 1)
  )
}

const asLine = (path: string): string => `${ADDITION}${TAB}${path}`

// _extractComparisonName is the seam the cancellation index actually reads.
// Driving it — rather than re-deriving the same expression here — is what makes
// this file a proof about the key and not about getFullyQualifiedName.
class CancellationKeyProbe extends RepoGitDiff {
  public cancellationKey(path: string): string {
    return this._extractComparisonName(asLine(path))
  }
}

let metadata: MetadataRepository
let factory: TypeHandlerFactory
let probe: CancellationKeyProbe
let components: Component[]
let unrepresentedFamilies: string[]
let sharedSuffixes: Map<string, string[]>

const descriptorOf = async (
  path: string
): Promise<{ id: string; type: string }> => {
  const handler = await factory.getTypeHandler(asLine(path))
  const { type, member } = handler.getElementDescriptor()
  return { id: `${type}/${member}`.toLocaleLowerCase(), type }
}

beforeAll(async () => {
  metadata = await getDefinition({})
  factory = new TypeHandlerFactory({
    config: getConfig(),
    metadata,
    trees: EMPTY_TREE_READER,
  })
  probe = new CancellationKeyProbe(getConfig(), metadata)
  sharedSuffixes = directoriesPerSharedSuffix(metadata.values())

  const perComponent = new Map<string, Component>()
  unrepresentedFamilies = []
  for (const family of metadata.values()) {
    let represented = false
    for (const paths of pathsFor(family)) {
      for (const path of paths) {
        if (!metadata.has(asLine(path))) continue
        represented = true
        const { id, type } = await descriptorOf(path)
        perComponent.set(id, {
          id,
          type,
          paths: [...new Set([...(perComponent.get(id)?.paths ?? []), path])],
        })
      }
    }
    if (!represented && family.directoryName) {
      unrepresentedFamilies.push(family.xmlName!)
    }
  }
  components = [...perComponent.values()]
})

describe('Given a corpus generated from every registry family', () => {
  it('When each family is asked for the paths it can appear under, Then only families with no directory of their own go unrepresented', () => {
    // Assert
    expect(unrepresentedFamilies).toStrictEqual([])
  })

  it('When the components are counted, Then enough of them carry more than one path to prove anything', () => {
    // Act
    const multiPath = components.filter(({ paths }) => paths.length > 1)

    // Assert
    expect(multiPath.length).toBeGreaterThanOrEqual(MIN_MULTI_PATH_COMPONENTS)
  })
})

describe('Given every component the corpus resolves to', () => {
  it('When its paths are reduced to their cancellation keys, Then the component answers under one key', () => {
    // Act — a single-path component cannot split, so it proves nothing here
    const split = components
      .filter(({ paths }) => paths.length > 1)
      .filter(
        ({ paths }) =>
          new Set(paths.map(path => probe.cancellationKey(path))).size > 1
      )
      .map(({ type }) => type)

    // Assert
    expect([...new Set(split)].sort()).toStrictEqual(
      [...KNOWN_SPLITS.keys()].sort()
    )
  })
})

describe('Given a corpus of distinct Salesforce components', () => {
  it('When each is reduced to its cancellation key, Then no two components share one', () => {
    // Arrange
    const typesPerKey = new Map<string, string[]>()
    for (const { type, paths } of components) {
      const key = probe.cancellationKey(paths[0])
      typesPerKey.set(key, [...(typesPerKey.get(key) ?? []), type])
    }

    // Act
    const collisions = [...typesPerKey.values()]
      .filter(types => types.length > 1)
      .map(types => [...new Set(types)].sort().join('|'))

    // Assert
    expect([...new Set(collisions)].sort()).toStrictEqual(
      [...KNOWN_COLLISIONS.keys()].sort()
    )
  })
})

describe('Given a suffix more than one type directory declares', () => {
  it('When the registry is asked which suffixes those are, Then every group that was once colliding is still among them', () => {
    // Assert — a registry that stopped declaring one of these would leave that
    // group's separation proven by nothing, so the floor is stated rather than
    // assumed.
    expect([...sharedSuffixes.keys()]).toEqual(
      expect.arrayContaining([...ONCE_COLLIDING_SUFFIXES])
    )
  })

  it('When one same-named component is filed under each declaring directory, Then no two of them share a cancellation key', () => {
    // Act
    const collisions = [...sharedSuffixes].filter(([suffix, directories]) => {
      const keys = directories.map(directory =>
        probe.cancellationKey(
          `${SOURCE}/${directory}/${SHARED_SUFFIX_NAME}.${suffix}`
        )
      )
      return new Set(keys).size < keys.length
    })

    // Assert
    expect(collisions).toStrictEqual([])
  })
})

describe('Given the residual collision between a report and its reporting folder', () => {
  // Reaching this needs a report filed directly under `reports/`, which SFDX
  // does not accept — reports live in folders, and unfiled ones use
  // `unfiled$public` — so the generated corpus above never emits this pair.
  // KNOWN_COLLISIONS records collisions the generated corpus reaches; this
  // pair is a different, unreachable-from-a-valid-layout population, so it is
  // pinned here by its own guard rather than folded into that map.
  const REPORT_PATH = `${SOURCE}/reports/Sales.report-meta.xml`
  const REPORT_FOLDER_PATH = `${SOURCE}/reports/Sales.reportFolder-meta.xml`

  it('When both are reduced to their cancellation key, Then they answer the same key', () => {
    // Act
    const reportKey = probe.cancellationKey(REPORT_PATH)
    const reportFolderKey = probe.cancellationKey(REPORT_FOLDER_PATH)

    // Assert
    expect(reportFolderKey).toStrictEqual(reportKey)
  })

  it('When both are reduced to their descriptor, Then they answer different components', async () => {
    // Act
    const reportDescriptor = await descriptorOf(REPORT_PATH)
    const reportFolderDescriptor = await descriptorOf(REPORT_FOLDER_PATH)

    // Assert
    expect(reportFolderDescriptor.id).not.toStrictEqual(reportDescriptor.id)
  })
})

describe('Given the unsupported flat CustomObjectTranslation layout', () => {
  it('When its key and descriptor are derived, Then the key names the holder while the descriptor answers a garbage member', async () => {
    // Arrange — `objectTranslations/<name>.objectTranslation-meta.xml` is not
    // a layout SFDX accepts, so the generator above never emits it; this pins
    // why the two sides are not compared there rather than leaving it unsaid.
    const flat = `${SOURCE}/objectTranslations/Alpha-fr.objectTranslation${METAFILE_SUFFIX}`

    // Act
    const key = probe.cancellationKey(flat)
    const { id } = await descriptorOf(flat)

    // Assert
    expect(key).toBe('objecttranslations/alpha-fr')
    expect(id).toBe(
      `customobjecttranslation/alpha-fr.objecttranslation${METAFILE_SUFFIX}`
    )
  })
})

describe('Given a folder-organised name that ends in Folder', () => {
  it('When key and descriptor are derived beside an extension-bearing sibling, Then both sides agree they are one component', async () => {
    // Arrange — the generator only names components Alpha and Beta, so a
    // name ending in Folder is a shape it never reaches; the key strips that
    // suffix the way the folder handler does, and this pins that they agree.
    const bare = `${SOURCE}/documents/${SUB_FOLDER}/logoFolder`
    const withExtension = `${SOURCE}/documents/${SUB_FOLDER}/logo.png`
    const spellings = [bare, withExtension]

    // Act
    const keys = new Set(spellings.map(path => probe.cancellationKey(path)))
    const ids = new Set(
      (await Promise.all(spellings.map(descriptorOf))).map(({ id }) => id)
    )

    // Assert
    expect(keys.size).toBe(1)
    expect(ids.size).toBe(1)
  })
})

describe('Given a composed component under a package root named after a registry directory', () => {
  it('When both spellings are keyed, Then the descriptor sees one component while the key sees two — a recorded residual', async () => {
    // Arrange — the composed arm anchors on the first registry directory in
    // the path, so a package root that happens to share a registry
    // directory's name (`applications`, `components`, …) is dragged into the
    // key. Mirroring the descriptor (the child's own directory and its parent
    // segment) would change every existing composed key, so the residual is
    // recorded here rather than fixed silently.
    const underNamedRoot =
      'applications/objects/Account/fields/X__c.field-meta.xml'
    const underPlainRoot = `${SOURCE}/objects/Account/fields/X__c.field-meta.xml`
    const spellings = [underNamedRoot, underPlainRoot]

    // Act
    const ids = new Set(
      (await Promise.all(spellings.map(descriptorOf))).map(({ id }) => id)
    )
    const keys = new Set(spellings.map(path => probe.cancellationKey(path)))

    // Assert
    expect(ids.size).toBe(1)
    expect(keys.size).toBe(2)
  })
})
