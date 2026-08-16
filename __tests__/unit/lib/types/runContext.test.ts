'use strict'
import { describe, expect, it } from 'vitest'

import { withRevisions } from '../../../../src/types/runContext'
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

    it('When called, Then trees is the same reference as the original context', () => {
      // Arrange
      const ctx = getContext()
      const revisions = { from: 'firstSHA', to: 'headSHA' }

      // Act
      const result = withRevisions(ctx, revisions)

      // Assert
      expect(result.trees).toBe(ctx.trees)
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
