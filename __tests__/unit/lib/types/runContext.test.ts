'use strict'
import { describe, expect, it } from 'vitest'

import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { createTreeReader } from '../../../../src/adapter/treeReader'
import {
  withMaskedTreeRevision,
  withRevisions,
} from '../../../../src/types/runContext'
import { getContext } from '../../../__utils__/testWork'

describe('withRevisions', () => {
  describe('Given a context and undefined revisions', () => {
    it('When called, Then returns the same object reference', () => {
      // Arrange
      const ctx = getContext()

      // Act
      const result = withRevisions(ctx)

      // Assert
      expect(result).toBe(ctx)
    })
  })

  describe('Given a context and a revisions override', () => {
    it('When called, Then overrides from/to and preserves every other config field', () => {
      // Arrange
      const ctx = getContext()
      const config = ctx.config
      const revisions = { from: 'firstSHA', to: 'headSHA' }

      // Act
      const result = withRevisions(ctx, revisions)

      // Assert
      expect(result.config.from).toBe('firstSHA')
      expect(result.config.to).toBe('headSHA')
      expect(result.config).toEqual({ ...config, ...revisions })
    })

    it('When called, Then trees is carried through untouched and still answers by revision', () => {
      // Arrange — deliberately NOT the fixture default. getContext() hands
      // out the shared EMPTY_TREE_READER, so a defensive rebind to that
      // same constant would satisfy a toBe() built on the default and the
      // invariant this test exists for would go unguarded.
      const index = new TreeIndex()
      index.add('force-app/Foo.cls')
      const trees = createTreeReader(new Map([['headSHA', index]]))
      const ctx = getContext({ trees })
      const revisions = { from: 'firstSHA', to: 'headSHA' }

      // Act
      const result = withRevisions(ctx, revisions)

      // Assert
      expect(result.trees).toBe(trees)
      expect(result.trees.filesUnder('headSHA', '')).toEqual([
        'force-app/Foo.cls',
      ])
    })

    it('When called, Then the original context is left unmutated', () => {
      // Arrange
      const ctx = getContext()
      const config = ctx.config
      const revisions = { from: 'firstSHA', to: 'headSHA' }

      // Act
      withRevisions(ctx, revisions)

      // Assert
      expect(ctx.config).toBe(config)
      expect(ctx.config.from).toBe('')
      expect(ctx.config.to).toBe('')
    })
  })
})

describe('withMaskedTreeRevision', () => {
  describe('Given a context whose trees holds a real index for a revision', () => {
    const buildCtx = () => {
      const index = new TreeIndex()
      index.add('force-app/lwc/still/still.js')
      const trees = createTreeReader(new Map([['firstSHA', index]]))
      return getContext({ trees })
    }

    it('When the revision is masked, Then trees reports it absent although the underlying reader holds it', () => {
      // Arrange
      const ctx = buildCtx()

      // Act
      const result = withMaskedTreeRevision(ctx, 'firstSHA')

      // Assert
      expect(
        result.trees.pathExists('firstSHA', 'force-app/lwc/still/still.js')
      ).toBe(false)
    })

    it('When the revision is masked, Then a different revision still reads through untouched', () => {
      // Arrange — otherSHA needs a REAL index holding the queried path:
      // buildCtx() alone has no index at otherSHA at all, so the
      // pass-through's true answer would be indistinguishable from a
      // masked always-false one.
      const index = new TreeIndex()
      index.add('force-app/lwc/still/still.js')
      const otherIndex = new TreeIndex()
      otherIndex.add('force-app/classes/Other.cls')
      const trees = createTreeReader(
        new Map([
          ['firstSHA', index],
          ['otherSHA', otherIndex],
        ])
      )
      const ctx = getContext({ trees })

      // Act
      const result = withMaskedTreeRevision(ctx, 'firstSHA')

      // Assert
      expect(
        result.trees.pathExists('otherSHA', 'force-app/classes/Other.cls')
      ).toBe(true)
    })

    it('When the revision is masked, Then config and metadata are carried through unchanged', () => {
      // Arrange
      const ctx = buildCtx()

      // Act
      const result = withMaskedTreeRevision(ctx, 'firstSHA')

      // Assert
      expect(result.config).toBe(ctx.config)
      expect(result.metadata).toBe(ctx.metadata)
    })

    it('When the revision is masked, Then the original context is left unmutated', () => {
      // Arrange
      const ctx = buildCtx()
      const originalTrees = ctx.trees

      // Act
      withMaskedTreeRevision(ctx, 'firstSHA')

      // Assert
      expect(ctx.trees).toBe(originalTrees)
      expect(
        ctx.trees.pathExists('firstSHA', 'force-app/lwc/still/still.js')
      ).toBe(true)
    })
  })
})
