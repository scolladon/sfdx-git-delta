'use strict'
import { describe, expect, it, vi } from 'vitest'
import { TreeIndex } from '../../../../src/adapter/treeIndex'
import {
  createTreeReader,
  type TreeReader,
} from '../../../../src/adapter/treeReader'
import { DOT, PATH_SEP } from '../../../../src/constant/fsConstants'
import type {
  CopyOperation,
  GitComponentCopyOperation,
} from '../../../../src/types/handlerResult'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
import { expandComponentCopies } from '../../../../src/utils/componentCopies'

const TO = 'to-revision'
const OTHER = 'other-revision'
const ROOT = 'force-app/main/default/staticresources'
const DOTS_BEYOND_STACK_DEPTH = 10_000

const indexOf = (paths: string[]): TreeIndex => {
  const index = new TreeIndex()
  for (const path of paths) index.add(path)
  return index
}

const readerOf = (paths: string[], revision = TO) =>
  createTreeReader(new Map([[revision, indexOf(paths)]]))

const request = (path: string, revision = TO): GitComponentCopyOperation => ({
  kind: CopyOperationKind.GitComponentCopy,
  path,
  revision,
})

const gitCopy = (path: string, revision = TO): CopyOperation => ({
  kind: CopyOperationKind.GitCopy,
  path,
  revision,
})

const pathsOf = (ops: readonly CopyOperation[]): string[] =>
  ops.map(op => op.path)

const isMemberOf =
  (component: string) =>
  (file: string): boolean =>
    file.startsWith(`${component}${PATH_SEP}`) ||
    file.startsWith(`${component}${DOT}`)

const parentOf = (path: string): string =>
  path.substring(0, path.lastIndexOf(PATH_SEP))

const firstSeen = (
  seen: Map<string, Set<string>>,
  op: GitComponentCopyOperation
) => {
  const paths = seen.get(op.revision) ?? new Set<string>()
  seen.set(op.revision, paths)
  const isFirst = !paths.has(op.path)
  paths.add(op.path)
  return isFirst
}

// Reference expansion: each distinct request lists its own parent and keeps
// its members, at its first occurrence; every other operation passes through.
const oracleOf = (
  copies: readonly CopyOperation[],
  trees: TreeReader
): CopyOperation[] => {
  const seen = new Map<string, Set<string>>()
  return copies.flatMap(op => {
    if (op.kind !== CopyOperationKind.GitComponentCopy) return [op]
    if (!firstSeen(seen, op)) return []
    return trees
      .filesUnder(op.revision, parentOf(op.path))
      .filter(isMemberOf(op.path))
      .map(path => gitCopy(path, op.revision))
  })
}

describe('expandComponentCopies', () => {
  describe('Given identical requests for one component', () => {
    it('When expanded, Then the reader lists the root once and yields each member', () => {
      // Arrange
      const trees = readerOf([
        `${ROOT}/Lib/a.js`,
        `${ROOT}/Lib/b.js`,
        `${ROOT}/Lib.resource-meta.xml`,
      ])
      const spy = vi.spyOn(trees, 'filesUnder')
      const copies = [1, 2, 3].map(() => request(`${ROOT}/Lib`))

      // Act
      const result = expandComponentCopies(copies, trees)

      // Assert
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(TO, ROOT)
      expect(result).toEqual([
        gitCopy(`${ROOT}/Lib/a.js`),
        gitCopy(`${ROOT}/Lib/b.js`),
        gitCopy(`${ROOT}/Lib.resource-meta.xml`),
      ])
    })
  })

  describe('Given the same path requested at two revisions', () => {
    it('When expanded, Then both expand with their own revision', () => {
      // Arrange
      const trees = createTreeReader(
        new Map([
          [TO, indexOf([`${ROOT}/Lib/a.js`])],
          [OTHER, indexOf([`${ROOT}/Lib/z.js`])],
        ])
      )
      const copies = [request(`${ROOT}/Lib`, TO), request(`${ROOT}/Lib`, OTHER)]

      // Act
      const result = expandComponentCopies(copies, trees)

      // Assert
      expect(result).toEqual([
        gitCopy(`${ROOT}/Lib/a.js`, TO),
        gitCopy(`${ROOT}/Lib/z.js`, OTHER),
      ])
    })
  })

  describe('Given requests interleaved with other operations', () => {
    it('When expanded, Then expansion sits at the first request and others pass through', () => {
      // Arrange
      const trees = readerOf([`${ROOT}/Lib/a.js`])
      const x = gitCopy('x')
      const y = gitCopy('y')
      const z: CopyOperation = {
        kind: CopyOperationKind.StreamedContent,
        path: 'z',
        writer: vi.fn().mockResolvedValue(undefined),
      }
      const copies = [x, request(`${ROOT}/Lib`), y, request(`${ROOT}/Lib`), z]

      // Act
      const result = expandComponentCopies(copies, trees)

      // Assert
      expect(result).toEqual([x, gitCopy(`${ROOT}/Lib/a.js`), y, z])
      expect(result[3]).toBe(z)
    })
  })

  describe('Given a single-file component', () => {
    it('When expanded, Then its dotted siblings are copied', () => {
      // Arrange
      const trees = readerOf([
        `${ROOT}/Logo.png`,
        `${ROOT}/Logo.resource-meta.xml`,
      ])

      // Act
      const result = expandComponentCopies([request(`${ROOT}/Logo`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([
        `${ROOT}/Logo.png`,
        `${ROOT}/Logo.resource-meta.xml`,
      ])
    })
  })

  describe('Given a component name holding a dot', () => {
    it('When expanded, Then the dot matches only itself', () => {
      // Arrange
      const trees = readerOf([
        `${ROOT}/my.Resource.resource-meta.xml`,
        `${ROOT}/myXResource.resource-meta.xml`,
      ])

      // Act
      const result = expandComponentCopies(
        [request(`${ROOT}/my.Resource`)],
        trees
      )

      // Assert
      expect(pathsOf(result)).toEqual([`${ROOT}/my.Resource.resource-meta.xml`])
    })
  })

  describe('Given a sibling component sharing the name prefix', () => {
    it('When expanded, Then nothing under the sibling is copied', () => {
      // Arrange
      const trees = readerOf([
        `${ROOT}/Lib/a.js`,
        `${ROOT}/Library/x.js`,
        `${ROOT}/Library.resource-meta.xml`,
      ])

      // Act
      const result = expandComponentCopies([request(`${ROOT}/Lib`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([`${ROOT}/Lib/a.js`])
    })
  })

  describe('Given a lookalike nested path', () => {
    it('When expanded, Then the nested path is not copied', () => {
      // Arrange
      const nested = `${ROOT}/Other/${ROOT}/Lib/x.js`
      const trees = readerOf([nested])

      // Act
      const result = expandComponentCopies([request(`${ROOT}/Lib`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([])
    })
  })

  describe('Given a file named exactly as the component', () => {
    it('When expanded, Then it is not a member', () => {
      // Arrange
      const sut = expandComponentCopies
      const trees = readerOf([`${ROOT}/Lib`])

      // Act
      const result = sut([request(`${ROOT}/Lib`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([])
    })
  })

  describe('Given a dotted sibling folder', () => {
    it('When the plain-named component is expanded, Then the folder files are copied', () => {
      // Arrange
      const sut = expandComponentCopies
      const trees = readerOf([`${ROOT}/Lib/a.js`, `${ROOT}/Lib.v2/x.js`])

      // Act
      const result = sut([request(`${ROOT}/Lib`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([
        `${ROOT}/Lib/a.js`,
        `${ROOT}/Lib.v2/x.js`,
      ])
    })
  })

  describe('Given a request path with no separator', () => {
    it('When expanded, Then the whole index is listed', () => {
      // Arrange
      const trees = readerOf(['Lib/a.js', 'Other/b.js'])
      const spy = vi.spyOn(trees, 'filesUnder')

      // Act
      const result = expandComponentCopies([request('Lib')], trees)

      // Assert
      expect(spy).toHaveBeenCalledWith(TO, '')
      expect(pathsOf(result)).toEqual(['Lib/a.js'])
    })
  })

  describe('Given a request at a revision with no index', () => {
    it('When expanded, Then it yields no operation', () => {
      // Arrange
      const trees = readerOf([`${ROOT}/Lib/a.js`])

      // Act
      const result = expandComponentCopies(
        [request(`${ROOT}/Lib`, 'unknown')],
        trees
      )

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('Given a bundle request and a page request beneath it', () => {
    it('When expanded, Then each parent is listed once and the page files appear once in each expansion', () => {
      // Arrange
      const sut = expandComponentCopies
      const site = 'force-app/main/default/digitalExperiences/site'
      const bundle = `${site}/Site_A`
      const view = `${bundle}/sfdc_cms__view`
      const page = `${view}/page_a`
      const trees = readerOf([
        `${bundle}/Site_A.digitalExperience-meta.xml`,
        `${page}/content.json`,
        `${view}/page_a.json`,
      ])
      const spy = vi.spyOn(trees, 'filesUnder')

      // Act
      const result = sut([request(bundle), request(page)], trees)

      // Assert
      expect(spy.mock.calls).toEqual([
        [TO, site],
        [TO, view],
      ])
      expect(pathsOf(result)).toEqual([
        `${bundle}/Site_A.digitalExperience-meta.xml`,
        `${page}/content.json`,
        `${view}/page_a.json`,
        `${page}/content.json`,
        `${view}/page_a.json`,
      ])
    })
  })

  describe('Given two dotted-sibling requests', () => {
    it('When expanded, Then the shared files appear in both expansions', () => {
      // Arrange
      const sut = expandComponentCopies
      const trees = readerOf([
        `${ROOT}/Lib/a.js`,
        `${ROOT}/Lib.v2/x.js`,
        `${ROOT}/Lib.v2.resource-meta.xml`,
      ])

      // Act
      const result = sut(
        [request(`${ROOT}/Lib`), request(`${ROOT}/Lib.v2`)],
        trees
      )

      // Assert
      expect(pathsOf(result)).toEqual([
        `${ROOT}/Lib/a.js`,
        `${ROOT}/Lib.v2/x.js`,
        `${ROOT}/Lib.v2.resource-meta.xml`,
        `${ROOT}/Lib.v2/x.js`,
        `${ROOT}/Lib.v2.resource-meta.xml`,
      ])
    })
  })

  describe('Given a leading-dot file beside a bundle', () => {
    it('When the bundle is expanded, Then the leading-dot file is not copied', () => {
      // Arrange
      const sut = expandComponentCopies
      const lwc = 'force-app/main/default/lwc'
      const trees = readerOf([`${lwc}/.eslintrc.json`, `${lwc}/cmp/cmp.js`])

      // Act
      const result = sut([request(`${lwc}/cmp`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([`${lwc}/cmp/cmp.js`])
    })
  })

  describe('Given an extensionless file one character longer than the component', () => {
    it('When expanded, Then it is not copied', () => {
      // Arrange
      const sut = expandComponentCopies
      const trees = readerOf([`${ROOT}/Libs`, `${ROOT}/Lib/a.js`])

      // Act
      const result = sut([request(`${ROOT}/Lib`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([`${ROOT}/Lib/a.js`])
    })
  })

  describe('Given every membership shape in one tree', () => {
    it('When expanded, Then the result equals the per-request reference expansion, order included', () => {
      // Arrange
      const sut = expandComponentCopies
      const site = 'force-app/main/default/digitalExperiences/site'
      const view = `${site}/Site_A/sfdc_cms__view`
      const trees = createTreeReader(
        new Map([
          [
            TO,
            indexOf([
              `${ROOT}/Lib/a.js`,
              `${ROOT}/Lib.resource-meta.xml`,
              `${ROOT}/Lib.v2/x.js`,
              `${ROOT}/Lib.v2.resource-meta.xml`,
              `${ROOT}/Library/x.js`,
              `${ROOT}/Libs`,
              `${ROOT}/Other/${ROOT}/Lib/x.js`,
              `${ROOT}/my.Resource.resource-meta.xml`,
              `${ROOT}/myXResource.resource-meta.xml`,
              `${ROOT}/.hidden`,
              `${site}/Site_A/Site_A.digitalExperience-meta.xml`,
              `${view}/page_a/content.json`,
              `${view}/page_a.json`,
              `${view}/page_b/content.json`,
              'Top/t.js',
              'Top.meta',
            ]),
          ],
          [OTHER, indexOf([`${ROOT}/Lib/z.js`])],
        ])
      )
      const copies = [
        gitCopy('x'),
        request(`${ROOT}/Lib.v2`),
        request(`${ROOT}/Lib`),
        request(`${view}/page_a`),
        gitCopy('y'),
        request(`${site}/Site_A`),
        request(`${ROOT}/Lib`, OTHER),
        request(`${ROOT}/my.Resource`),
        request(`${ROOT}/Lib`),
        request('Top'),
        request(`${ROOT}/Missing`),
      ]
      const expected = oracleOf(copies, trees)

      // Act
      const result = sut(copies, trees)

      // Assert
      expect(result).toEqual(expected)
    })
  })

  describe('Given requests for distinct components in one type directory', () => {
    it('When expanded, Then the directory is listed once and each request yields its own files in place', () => {
      // Arrange
      const sut = expandComponentCopies
      const trees = readerOf([
        `${ROOT}/A/a.js`,
        `${ROOT}/A.resource-meta.xml`,
        `${ROOT}/B/b.js`,
        `${ROOT}/B.resource-meta.xml`,
        `${ROOT}/C/c.js`,
        `${ROOT}/C.resource-meta.xml`,
      ])
      const spy = vi.spyOn(trees, 'filesUnder')
      const passThrough = gitCopy('x')
      const copies = [
        request(`${ROOT}/C`),
        passThrough,
        request(`${ROOT}/A`),
        request(`${ROOT}/B`),
      ]

      // Act
      const result = sut(copies, trees)

      // Assert
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith(TO, ROOT)
      expect(result).toEqual([
        gitCopy(`${ROOT}/C/c.js`),
        gitCopy(`${ROOT}/C.resource-meta.xml`),
        passThrough,
        gitCopy(`${ROOT}/A/a.js`),
        gitCopy(`${ROOT}/A.resource-meta.xml`),
        gitCopy(`${ROOT}/B/b.js`),
        gitCopy(`${ROOT}/B.resource-meta.xml`),
      ])
    })
  })

  describe('Given requests at two revisions under one parent', () => {
    it('When expanded, Then the parent is listed once per revision', () => {
      // Arrange
      const sut = expandComponentCopies
      const a = `${ROOT}/A`
      const trees = createTreeReader(
        new Map([
          [TO, indexOf([`${a}/a.js`, `${ROOT}/B/b.js`])],
          [OTHER, indexOf([`${a}/z.js`])],
        ])
      )
      const spy = vi.spyOn(trees, 'filesUnder')
      const copies = [request(a), request(`${ROOT}/B`), request(a, OTHER)]

      // Act
      const result = sut(copies, trees)

      // Assert
      expect(spy.mock.calls).toEqual([
        [TO, ROOT],
        [OTHER, ROOT],
      ])
      expect(result).toEqual([
        gitCopy(`${a}/a.js`),
        gitCopy(`${ROOT}/B/b.js`),
        gitCopy(`${a}/z.js`, OTHER),
      ])
    })
  })

  describe('Given a sibling file whose name holds thousands of dots', () => {
    it('When expanded, Then it is assigned without exhausting the stack', () => {
      // Arrange
      const sut = expandComponentCopies
      const dotted = `${ROOT}/Lib${DOT.repeat(DOTS_BEYOND_STACK_DEPTH)}`
      const trees = readerOf([dotted])

      // Act
      const result = sut([request(`${ROOT}/Lib`)], trees)

      // Assert
      expect(pathsOf(result)).toEqual([dotted])
    })
  })
})
