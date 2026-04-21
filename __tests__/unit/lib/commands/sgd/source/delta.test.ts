'use strict'
import { describe, expect, it } from 'vitest'

import SourceDeltaGenerate from '../../../../../../src/commands/sgd/source/delta'
import { CHANGES_MANIFEST_BARE_MARKER } from '../../../../../../src/constant/cliConstants'

// _expandBareChangesManifest is `protected static` — access it via the class
// indexer for focused argv-surgery coverage.
const expand = (argv: string[]): string[] =>
  (
    SourceDeltaGenerate as unknown as {
      _expandBareChangesManifest: (a: string[]) => string[]
    }
  )._expandBareChangesManifest(argv)

describe('SourceDeltaGenerate._expandBareChangesManifest', () => {
  describe('Given --changes-manifest at end of argv (no following token)', () => {
    it('When expanding, Then injects the bare marker so oclif parses the flag as set', () => {
      // Arrange
      const argv = ['--from', 'HEAD~1', '--changes-manifest']

      // Act
      const result = expand(argv)

      // Assert
      expect(result).toEqual([
        '--from',
        'HEAD~1',
        '--changes-manifest',
        CHANGES_MANIFEST_BARE_MARKER,
      ])
    })
  })

  describe('Given -c followed by another flag', () => {
    it('When expanding, Then injects the bare marker before the next flag', () => {
      // Arrange
      const argv = ['-c', '--from', 'HEAD~1']

      // Act
      const result = expand(argv)

      // Assert
      expect(result).toEqual([
        '-c',
        CHANGES_MANIFEST_BARE_MARKER,
        '--from',
        'HEAD~1',
      ])
    })
  })

  describe('Given --changes-manifest followed by a concrete relative path', () => {
    it('When expanding, Then leaves argv unchanged (no injection)', () => {
      // Arrange
      const argv = ['--changes-manifest', 'reports/changes.json']

      // Act
      const result = expand(argv)

      // Assert
      expect(result).toEqual(['--changes-manifest', 'reports/changes.json'])
    })
  })

  describe('Given -c followed by an absolute path', () => {
    it('When expanding, Then leaves argv unchanged', () => {
      // Arrange
      const argv = ['-c', '/tmp/changes.json']

      // Act
      const result = expand(argv)

      // Assert
      expect(result).toEqual(['-c', '/tmp/changes.json'])
    })
  })

  describe('Given argv with no --changes-manifest/-c token', () => {
    it('When expanding, Then returns the argv verbatim', () => {
      // Arrange
      const argv = ['--from', 'HEAD~1', '--to', 'HEAD']

      // Act
      const result = expand(argv)

      // Assert
      expect(result).toEqual(['--from', 'HEAD~1', '--to', 'HEAD'])
    })
  })

  describe('Given two consecutive -c tokens (pathological but observable)', () => {
    it('When expanding, Then each standalone -c gets its own marker injection', () => {
      // Arrange
      const argv = ['-c', '-c']

      // Act
      const result = expand(argv)

      // Assert
      // The first -c sees the second -c (starts with `-`) → inject marker.
      // The second -c has nothing after it → also inject marker.
      expect(result).toEqual([
        '-c',
        CHANGES_MANIFEST_BARE_MARKER,
        '-c',
        CHANGES_MANIFEST_BARE_MARKER,
      ])
    })
  })
})
