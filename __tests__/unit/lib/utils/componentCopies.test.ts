'use strict'
import { describe, expect, it, vi } from 'vitest'
import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { createTreeReader } from '../../../../src/adapter/treeReader'
import type {
  CopyOperation,
  GitComponentCopyOperation,
} from '../../../../src/types/handlerResult'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
import { expandComponentCopies } from '../../../../src/utils/componentCopies'

const TO = 'to-revision'
const OTHER = 'other-revision'
const ROOT = 'force-app/main/default/staticresources'

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
})
