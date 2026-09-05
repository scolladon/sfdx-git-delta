'use strict'
import { describe, expect, it, vi } from 'vitest'

import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { EMPTY_TREE_READER } from '../../../../src/adapter/treeReader'
import { buildRunTreeReader } from '../../../../src/utils/treeReaderBuilder'

const revisions = { to: 'HEAD', from: 'HEAD~1' }
const scope = ['force-app/main/default/lwc/foo']

const indexOf = (path: string): TreeIndex => {
  const index = new TreeIndex()
  index.add(path)
  return index
}

describe('buildRunTreeReader', () => {
  describe('Given an empty scope', () => {
    it('When the reader is built, Then EMPTY_TREE_READER is returned by reference, no tree is indexed and nothing is reported unindexed', async () => {
      // Arrange
      const gitAdapter = { buildTreeIndex: vi.fn() }

      // Act
      const result = await buildRunTreeReader(gitAdapter, revisions, [])

      // Assert
      expect(result.trees).toBe(EMPTY_TREE_READER)
      expect(result.unindexed).toEqual([])
      expect(gitAdapter.buildTreeIndex).not.toHaveBeenCalled()
    })
  })

  describe('Given a non-empty scope', () => {
    it('When the reader is built, Then buildTreeIndex is called once for config.to and once for config.from with the same scope', async () => {
      // Arrange
      const gitAdapter = { buildTreeIndex: vi.fn() }
      gitAdapter.buildTreeIndex.mockResolvedValue(undefined)

      // Act
      await buildRunTreeReader(gitAdapter, revisions, scope)

      // Assert
      expect(gitAdapter.buildTreeIndex).toHaveBeenCalledTimes(2)
      expect(gitAdapter.buildTreeIndex).toHaveBeenNthCalledWith(
        1,
        'HEAD',
        scope
      )
      expect(gitAdapter.buildTreeIndex).toHaveBeenNthCalledWith(
        2,
        'HEAD~1',
        scope
      )
    })
  })

  describe('Given both revisions index', () => {
    it('When the reader is built, Then each revision answers with its own listing and nothing is reported unindexed', async () => {
      // Arrange
      const toIndex = indexOf('force-app/main/default/lwc/foo/foo.js')
      const fromIndex = indexOf('force-app/main/default/lwc/foo/foo.html')
      const gitAdapter = { buildTreeIndex: vi.fn() }
      gitAdapter.buildTreeIndex
        .mockResolvedValueOnce(toIndex)
        .mockResolvedValueOnce(fromIndex)

      // Act
      const { trees, unindexed } = await buildRunTreeReader(
        gitAdapter,
        revisions,
        scope
      )

      // Assert
      expect(trees.filesUnder('HEAD', '')).toEqual([
        'force-app/main/default/lwc/foo/foo.js',
      ])
      expect(trees.filesUnder('HEAD~1', '')).toEqual([
        'force-app/main/default/lwc/foo/foo.html',
      ])
      expect(
        trees.pathExists('HEAD', 'force-app/main/default/lwc/foo/foo.html')
      ).toBe(false)
      expect(unindexed).toEqual([])
    })
  })

  describe('Given the to walk succeeds and the from walk fails', () => {
    it('When the reader is built, Then to answers with real data, from degrades to empty and from is reported unindexed', async () => {
      // Arrange
      const toIndex = indexOf('force-app/main/default/lwc/foo/foo.js')
      const gitAdapter = { buildTreeIndex: vi.fn() }
      gitAdapter.buildTreeIndex
        .mockResolvedValueOnce(toIndex)
        .mockResolvedValueOnce(undefined)

      // Act
      const { trees, unindexed } = await buildRunTreeReader(
        gitAdapter,
        revisions,
        scope
      )

      // Assert
      expect(trees.filesUnder('HEAD', '')).toEqual([
        'force-app/main/default/lwc/foo/foo.js',
      ])
      expect(trees.filesUnder('HEAD~1', '')).toEqual([])
      expect(trees.pathExists('HEAD~1', '')).toBe(false)
      expect(unindexed).toEqual(['HEAD~1'])
    })
  })

  describe('Given the to walk fails and the from walk succeeds', () => {
    it('When the reader is built, Then to degrades to empty, from answers with real data and to is reported unindexed', async () => {
      // Arrange
      const fromIndex = indexOf('force-app/main/default/lwc/foo/foo.html')
      const gitAdapter = { buildTreeIndex: vi.fn() }
      gitAdapter.buildTreeIndex
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(fromIndex)

      // Act
      const { trees, unindexed } = await buildRunTreeReader(
        gitAdapter,
        revisions,
        scope
      )

      // Assert
      expect(trees.filesUnder('HEAD', '')).toEqual([])
      expect(trees.pathExists('HEAD', '')).toBe(false)
      expect(trees.filesUnder('HEAD~1', '')).toEqual([
        'force-app/main/default/lwc/foo/foo.html',
      ])
      expect(unindexed).toEqual(['HEAD'])
    })
  })
})
