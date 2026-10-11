'use strict'
import { ObjectId } from '@scolladon/tsgit'
import { beforeAll, describe, expect, it } from 'vitest'

import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { comparisonName } from '../../../../src/utils/comparisonName'
import {
  type Candidate,
  candidateOf,
  indexComponents,
  isKept,
  isPure,
  listingRoots,
  type MoveEnv,
  type MoveGroup,
  movedPathsOf,
  type Probe,
  probesOf,
} from '../../../../src/utils/componentMove'
import type { RevisionView } from '../../../../src/utils/revisionSide'
import { SfdxProject } from '../../../../src/utils/sfdxProject'

const OLD_DIR = 'force-app/main/default/classes'
const NEW_DIR = 'force-app/other/classes'
const OLD_CLS = `${OLD_DIR}/Foo.cls`
const OLD_META = `${OLD_DIR}/Foo.cls-meta.xml`
const NEW_CLS = `${NEW_DIR}/Foo.cls`
const NEW_META = `${NEW_DIR}/Foo.cls-meta.xml`
const SOURCE = ['force-app']
const PROJECT = SfdxProject.parse(
  JSON.stringify({ packageDirectories: [{ path: 'force-app' }] })
)

const idOf = (hex: string): ObjectId => ObjectId.from(hex.padEnd(40, '0'))

const sideOf = (files: Record<string, string>, project = PROJECT) => ({
  project,
  blobIds: new Map(
    Object.entries(files).map(([path, hex]) => [path, idOf(hex)])
  ),
})

const probe = (member = 'Foo', comparesElements = false): Probe => ({
  type: 'ApexClass',
  member,
  comparesElements,
})

describe('Given the pure component move checks', () => {
  let metadata: MetadataRepository
  let env: MoveEnv

  beforeAll(async () => {
    metadata = await getDefinition({})
    env = { metadata, source: SOURCE, ignore: { keep: () => true } }
    group = groupOf([OLD_CLS, OLD_META], [NEW_CLS, NEW_META])
  })

  const groupOf = (
    deletions: readonly string[],
    additions: readonly string[]
  ): MoveGroup => ({
    name: comparisonName(metadata, `D\t${deletions[0]}`),
    deletions: deletions.map(path => `D\t${path}`),
    additions: additions.map(path => `A\t${path}`),
  })

  const probesFor = (group: MoveGroup, answer = probe()) =>
    new Map(
      [...group.deletions, ...group.additions].map(line => [line, answer])
    )

  const viewOf = (
    from: Record<string, string>,
    to: Record<string, string>
  ): RevisionView => ({ from: sideOf(from), to: sideOf(to) })

  const sameBlobs = viewOf(
    { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
    { [NEW_CLS]: 'a1', [NEW_META]: 'b1' }
  )
  let group: MoveGroup

  describe('movedPathsOf', () => {
    it('When the group holds git lines, Then it exposes their paths', () => {
      // Act
      const result = movedPathsOf(group)

      // Assert
      expect(result).toEqual({
        deletions: [OLD_CLS, OLD_META],
        additions: [NEW_CLS, NEW_META],
      })
    })
  })

  describe('probesOf', () => {
    it('When every line is probed, Then the probes are returned', () => {
      // Act
      const result = probesOf(group, probesFor(group))

      // Assert
      expect(result).toHaveLength(4)
    })

    it('When one line is not probed, Then nothing is returned', () => {
      // Arrange
      const probes = probesFor(group)
      probes.delete(group.additions[0] as string)

      // Act
      const result = probesOf(group, probes)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('isKept', () => {
    it('When the ignore helper rejects the addition line, Then the path is not kept', () => {
      // Act
      const result = isKept(OLD_CLS, { keep: line => line !== `A\t${OLD_CLS}` })

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('listingRoots', () => {
    it('When every path has a type directory, Then one root per path is returned', () => {
      // Act
      const result = listingRoots(movedPathsOf(group), metadata)

      // Assert
      expect(result).toEqual([OLD_DIR, OLD_DIR, NEW_DIR, NEW_DIR])
    })

    it('When a path belongs to no known type, Then no roots are returned', () => {
      // Act
      const result = listingRoots(
        { deletions: ['README.md'], additions: [NEW_CLS] },
        metadata
      )

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('candidateOf', () => {
    it('When the group is a plain move inside one entry, Then it is a candidate labelled by its identity', () => {
      // Act
      const result = candidateOf(group, probesFor(group), sameBlobs, env)

      // Assert
      expect(result?.label).toBe('ApexClass:Foo')
      expect(result?.roots).toEqual([OLD_DIR, OLD_DIR, NEW_DIR, NEW_DIR])
    })

    it('When the group holds no line at all, Then it is no candidate', () => {
      // Arrange
      const empty = { name: 'none', deletions: [], additions: [] }

      // Act
      const result = candidateOf(empty, new Map(), sameBlobs, env)

      // Assert
      expect(result).toBeUndefined()
    })

    it('When the probes disagree on the member, Then it is no candidate', () => {
      // Arrange
      const probes = probesFor(group)
      probes.set(group.additions[0] as string, probe('Bar'))

      // Act
      const result = candidateOf(group, probes, sameBlobs, env)

      // Assert
      expect(result).toBeUndefined()
    })

    it('When a probe compares elements, Then it is no candidate', () => {
      // Act
      const result = candidateOf(
        group,
        probesFor(group, probe('Foo', true)),
        sameBlobs,
        env
      )

      // Assert
      expect(result).toBeUndefined()
    })

    it('When a deleted file is ignored, Then it is no candidate', () => {
      // Act
      const result = candidateOf(group, probesFor(group), sameBlobs, {
        ...env,
        ignore: { keep: () => false },
      })

      // Assert
      expect(result).toBeUndefined()
    })

    it('When the files change package directory, Then it is no candidate', () => {
      // Arrange
      const project = SfdxProject.parse(
        JSON.stringify({
          packageDirectories: [
            { path: 'force-app/main' },
            { path: 'force-app/other' },
          ],
        })
      )
      const view = { from: sideOf({}, project), to: sideOf({}, project) }

      // Act
      const result = candidateOf(group, probesFor(group), view, env)

      // Assert
      expect(result).toBeUndefined()
    })

    it('When a path has no type directory, Then it is no candidate', () => {
      // Arrange
      const stray = groupOf([OLD_CLS], ['force-app/README.md'])

      // Act
      const result = candidateOf(stray, probesFor(stray), sameBlobs, env)

      // Assert
      expect(result).toBeUndefined()
    })
  })

  describe('indexComponents', () => {
    it('When there is no candidate, Then nothing is indexed', () => {
      // Act
      const result = indexComponents([], sameBlobs, env)

      // Assert
      expect(result.from.size).toBe(0)
      expect(result.to.size).toBe(0)
    })

    it('When a candidate exists, Then ignored files are left out', () => {
      // Arrange
      const candidate = candidateOf(group, probesFor(group), sameBlobs, env)
      const view = viewOf(
        { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
        { [NEW_CLS]: 'a1' }
      )

      // Act
      const result = indexComponents(candidate ? [candidate] : [], view, {
        ...env,
        ignore: { keep: line => line !== `A\t${NEW_CLS}` },
      })

      // Assert
      expect(result.from.get(group.name)).toEqual([OLD_CLS, OLD_META])
      expect(result.to.size).toBe(0)
    })

    it('When a candidate root holds a file outside the source, Then that file is left out', () => {
      // Arrange
      const outOfSource = `${NEW_DIR}/sub/Foo.cls`
      const inSource = [OLD_CLS, OLD_META, NEW_CLS, NEW_META]
      const candidate = candidateOf(group, probesFor(group), sameBlobs, env)
      const view = viewOf(
        { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
        { [NEW_CLS]: 'a1', [NEW_META]: 'b1', [outOfSource]: 'c1' }
      )

      // Act
      const result = indexComponents(candidate ? [candidate] : [], view, {
        ...env,
        source: inSource,
      })

      // Assert
      expect(result.to.get(group.name)).toEqual([NEW_CLS, NEW_META])
    })
  })

  describe('isPure', () => {
    const verdict = (view: RevisionView): boolean => {
      const candidate = candidateOf(group, probesFor(group), view, env)
      if (!candidate) return false
      const indexes = indexComponents([candidate], view, env)
      return isPure(group.name, candidate, view, indexes)
    }

    it('When the whole component moved with identical content, Then it is pure', () => {
      // Act
      const result = verdict(sameBlobs)

      // Assert
      expect(result).toBe(true)
    })

    it('When one file changed content, Then it is not pure', () => {
      // Act
      const result = verdict(
        viewOf(
          { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
          { [NEW_CLS]: 'a1', [NEW_META]: 'b2' }
        )
      )

      // Assert
      expect(result).toBe(false)
    })

    it('When the files moved to a different layout, Then it is not pure', () => {
      // Arrange
      const regrouped = groupOf(
        [OLD_CLS, OLD_META],
        [NEW_CLS, `${NEW_DIR}/sub/Foo.cls-meta.xml`]
      )
      const view = viewOf(
        { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
        { [NEW_CLS]: 'a1', [`${NEW_DIR}/sub/Foo.cls-meta.xml`]: 'b1' }
      )
      const candidate = candidateOf(regrouped, probesFor(regrouped), view, env)
      const indexes = indexComponents(candidate ? [candidate] : [], view, env)

      // Act
      const result = candidate
        ? isPure(regrouped.name, candidate, view, indexes)
        : undefined

      // Assert
      expect(result).toBe(false)
    })

    it('When an unchanged same-named file sits under another candidate root, Then the component is still pure', () => {
      // Arrange
      const barOld = 'force-app/bar-old/classes/Bar.cls'
      const barNew = 'force-app/bar-new/classes/Bar.cls'
      const bystander = 'force-app/bar-new/classes/Foo.cls'
      const bar = groupOf([barOld], [barNew])
      const view = viewOf(
        {
          [OLD_CLS]: 'a1',
          [OLD_META]: 'b1',
          [barOld]: 'd1',
          [bystander]: 'e1',
        },
        { [NEW_CLS]: 'a1', [NEW_META]: 'b1', [barNew]: 'd1', [bystander]: 'e1' }
      )
      const candidates = [group, bar].flatMap(moved => {
        const found = candidateOf(moved, probesFor(moved), view, env)
        return found ? [found] : []
      })
      const indexes = indexComponents(candidates, view, env)

      // Act
      const result = isPure(
        group.name,
        candidates[0] as Candidate,
        view,
        indexes
      )

      // Assert
      expect(result).toBe(true)
    })

    describe('with a nested bundle layout', () => {
      const OLD_BUNDLE = 'force-app/main/default/lwc/cmp'
      const NEW_BUNDLE = 'force-app/other/lwc/cmp'
      const files = ['cmp.js', 'cmp.html', '__tests__/cmp.test.js']
      const bundleVerdict = (
        changed?: string,
        moved: readonly string[] = files
      ): boolean => {
        const bundle = groupOf(
          files.map(file => `${OLD_BUNDLE}/${file}`),
          moved.map(file => `${NEW_BUNDLE}/${file}`)
        )
        const view = viewOf(
          Object.fromEntries(
            files.map(file => [`${OLD_BUNDLE}/${file}`, 'a1'])
          ),
          Object.fromEntries(
            moved.map(file => [
              `${NEW_BUNDLE}/${file}`,
              file === changed ? 'ff' : 'a1',
            ])
          )
        )
        const candidate = candidateOf(bundle, probesFor(bundle), view, env)
        if (!candidate) return false
        const indexes = indexComponents([candidate], view, env)
        return isPure(bundle.name, candidate, view, indexes)
      }

      it('When every file keeps its relative path and blob, Then it is pure', () => {
        // Act
        const result = bundleVerdict()

        // Assert
        expect(result).toBe(true)
      })

      it('When a nested file changed content, Then it is not pure', () => {
        // Act
        const result = bundleVerdict('__tests__/cmp.test.js')

        // Assert
        expect(result).toBe(false)
      })

      it('When a nested file lands at another relative path, Then it is not pure', () => {
        // Act
        const result = bundleVerdict(undefined, [
          'cmp.js',
          'cmp.html',
          'cmp.test.js',
        ])

        // Assert
        expect(result).toBe(false)
      })
    })

    it('When the moved files share no common directory, Then relative paths are the paths themselves', () => {
      // Arrange
      const rootProject = SfdxProject.parse(
        JSON.stringify({ packageDirectories: [{ path: '.' }] })
      )
      const scattered = groupOf(
        ['a/classes/Foo.cls', 'b/classes/Foo.cls-meta.xml'],
        ['c/classes/Foo.cls', 'd/classes/Foo.cls-meta.xml']
      )
      const view: RevisionView = {
        from: sideOf(
          { 'a/classes/Foo.cls': 'a1', 'b/classes/Foo.cls-meta.xml': 'b1' },
          rootProject
        ),
        to: sideOf(
          { 'c/classes/Foo.cls': 'a1', 'd/classes/Foo.cls-meta.xml': 'b1' },
          rootProject
        ),
      }
      const rootEnv = { ...env, source: ['.'] }
      const candidate = candidateOf(
        scattered,
        probesFor(scattered),
        view,
        rootEnv
      ) as Candidate
      const indexes = indexComponents([candidate], view, rootEnv)

      // Act
      const result = isPure(scattered.name, candidate, view, indexes)

      // Assert
      expect(result).toBe(false)
    })

    it('When a sibling file of the component stayed behind, Then it is not pure', () => {
      // Arrange
      const partial = groupOf([OLD_CLS], [NEW_CLS])
      const view = viewOf(
        { [OLD_CLS]: 'a1', [OLD_META]: 'b1' },
        { [NEW_CLS]: 'a1' }
      )
      const candidate = candidateOf(partial, probesFor(partial), view, env)
      const indexes = indexComponents(candidate ? [candidate] : [], view, env)

      // Act
      const result = candidate
        ? isPure(partial.name, candidate, view, indexes)
        : undefined

      // Assert
      expect(result).toBe(false)
    })
  })
})
