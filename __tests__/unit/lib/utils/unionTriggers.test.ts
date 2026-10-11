'use strict'
import { ObjectId } from '@scolladon/tsgit'
import { beforeAll, describe, expect, it } from 'vitest'

import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import type {
  MoveEnv,
  MoveGroup,
  Probe,
} from '../../../../src/utils/componentMove'
import { LABELS_UNION_SCOPE } from '../../../../src/utils/containerUnion'
import type { RevisionView } from '../../../../src/utils/revisionSide'
import { SfdxProject } from '../../../../src/utils/sfdxProject'
import { toUnionTargets, triggersOf } from '../../../../src/utils/unionTriggers'

const OLD_LABELS = 'force-app/a/labels/CustomLabels.labels-meta.xml'
const NEW_LABELS = 'force-app/b/labels/CustomLabels.labels-meta.xml'
const OTHER_ENTRY_LABELS = 'other-app/b/labels/CustomLabels.labels-meta.xml'
const PROJECT = SfdxProject.parse(
  JSON.stringify({
    packageDirectories: [{ path: 'force-app' }, { path: 'other-app' }],
  })
)
const OBJECT_ID = ObjectId.from('a'.repeat(40))

const sideOf = (...paths: string[]) => ({
  project: PROJECT,
  blobIds: new Map(paths.map(path => [path, OBJECT_ID])),
})

const comparing: Probe = {
  type: 'CustomLabels',
  member: 'CustomLabels',
  comparesElements: true,
}

describe('Given the union triggers of moved containers', () => {
  let metadata: MetadataRepository
  let env: MoveEnv

  beforeAll(async () => {
    metadata = await getDefinition({})
    env = { metadata, source: ['force-app'], ignore: { keep: () => true } }
  })

  const groupOf = (
    deletions: readonly string[],
    additions: readonly string[]
  ): MoveGroup => ({
    name: 'labels',
    deletions: deletions.map(path => `D\t${path}`),
    additions: additions.map(path => `A\t${path}`),
  })

  const probesFor = (group: MoveGroup, probe: Probe = comparing) =>
    new Map([...group.deletions, ...group.additions].map(l => [l, probe]))

  const view: RevisionView = { from: sideOf(), to: sideOf() }

  describe('triggersOf', () => {
    it('When a comparing container moved inside one entry, Then one trigger carries the listing roots', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], [NEW_LABELS])

      // Act
      const result = triggersOf(group, probesFor(group), view, env)

      // Assert
      expect(result).toEqual([
        {
          scope: LABELS_UNION_SCOPE,
          entry: 'force-app',
          roots: ['force-app/a/labels', 'force-app/b/labels'],
        },
      ])
    })

    it('When no probe compares elements, Then there is no trigger', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], [NEW_LABELS])
      const probes = probesFor(group, { ...comparing, comparesElements: false })

      // Act
      const result = triggersOf(group, probes, view, env)

      // Assert
      expect(result).toEqual([])
    })

    it('When only some probes compare elements, Then one trigger is built', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], [NEW_LABELS])
      const probes = probesFor(group)
      probes.set(group.additions[0] as string, {
        ...comparing,
        comparesElements: false,
      })

      // Act
      const result = triggersOf(group, probes, view, env)

      // Assert
      expect(result).toHaveLength(1)
    })

    it('When a line was not probed, Then there is no trigger', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], [NEW_LABELS])

      // Act
      const result = triggersOf(group, new Map(), view, env)

      // Assert
      expect(result).toEqual([])
    })

    it('When the group has no deletion, Then there is no trigger', () => {
      // Arrange
      const group = groupOf([], [NEW_LABELS])

      // Act
      const result = triggersOf(group, probesFor(group), view, env)

      // Assert
      expect(result).toEqual([])
    })

    it('When the container arrived in another entry, Then there is no trigger', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], [OTHER_ENTRY_LABELS])

      // Act
      const result = triggersOf(group, probesFor(group), view, env)

      // Assert
      expect(result).toEqual([])
    })

    it('When the deleted container is ignored, Then there is no trigger', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], [NEW_LABELS])

      // Act
      const result = triggersOf(group, probesFor(group), view, {
        ...env,
        ignore: { keep: () => false },
      })

      // Assert
      expect(result).toEqual([])
    })

    it('When a path has no type directory, Then there is no trigger', () => {
      // Arrange
      const group = groupOf([OLD_LABELS], ['force-app/README.md'])

      // Act
      const result = triggersOf(group, probesFor(group), view, env)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('toUnionTargets', () => {
    it('When triggers share a scope and entry, Then their roots merge sorted without duplicates', () => {
      // Arrange
      const triggers = [
        { scope: 'S', entry: 'e', roots: ['b', 'a'] },
        { scope: 'S', entry: 'e', roots: ['a', 'c'] },
        { scope: 'S', entry: null, roots: ['z'] },
      ]

      // Act
      const result = toUnionTargets(triggers)

      // Assert
      expect(result).toEqual([
        { scope: 'S', entry: 'e', listingRoots: ['a', 'b', 'c'] },
        { scope: 'S', entry: null, listingRoots: ['z'] },
      ])
    })

    it('When there is no trigger, Then there is no target', () => {
      // Act
      const result = toUnionTargets([])

      // Assert
      expect(result).toEqual([])
    })
  })
})
