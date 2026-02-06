'use strict'
import { describe, expect, it, jest } from '@jest/globals'
import { outputFile } from 'fs-extra'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import PackageGenerator from '../../../../src/post-processor/packageGenerator'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

jest.mock('fs-extra')

const mockBuildPackage = jest.fn()
jest.mock('../../../../src/utils/packageHelper', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return { buildPackage: mockBuildPackage }
    }),
  }
})

describe('PackageGenerator', () => {
  let work: Work
  let metadata: MetadataRepository
  beforeEach(async () => {
    work = getWork()
    metadata = await getDefinition({})
  })
  describe('cleanPackages', () => {
    describe('when destructive contains element from additive', () => {
      it('removes same element from destructive', () => {
        // Arrange
        const type = 'type'
        const element = 'element'
        const additive = new Map([[type, new Set([element])]])
        const destructive = new Map([[type, new Set([element, 'other'])]])
        work.diffs.package = additive
        work.diffs.destructiveChanges = destructive
        work.config.output = 'test'
        const sut = new PackageGenerator(work, metadata)

        // Act
        sut['_cleanPackages']()

        // Assert
        expect(additive.get(type)!.has(element)).toEqual(true)
        expect(destructive.get(type)!.has(element)).toEqual(false)
      })

      describe('when destructive does not have element anymore', () => {
        it('removes same element from destructive', () => {
          // Arrange
          const type = 'type'
          const element = 'element'
          const additive = new Map([[type, new Set([element])]])
          const destructive = new Map([[type, new Set([element])]])
          work.diffs.package = additive
          work.diffs.destructiveChanges = destructive
          work.config.output = 'test'
          const sut = new PackageGenerator(work, metadata)

          // Act
          sut['_cleanPackages']()

          // Assert
          expect(additive.get(type)!.has(element)).toEqual(true)
          expect(destructive.has(type)).toEqual(false)
        })
      })
    })

    describe('when destructive does not contain element from additive', () => {
      it('keeps both elements', () => {
        // Arrange
        const type = 'type'
        const element = 'element'
        const additive = new Map([[type, new Set([element])]])
        const destructive = new Map([[type, new Set(['otherElement'])]])
        work.diffs.package = additive
        work.diffs.destructiveChanges = destructive
        work.config.output = 'test'
        const sut = new PackageGenerator(work, metadata)

        // Act
        sut['_cleanPackages']()

        // Assert
        expect(additive.get(type)!.has(element)).toEqual(true)
        expect(destructive.get(type)!.has('otherElement')).toEqual(true)
      })
    })
  })

  describe('buildPackages', () => {
    let sut: PackageGenerator
    beforeEach(() => {
      // Arrange
      work.config.output = 'test'
      sut = new PackageGenerator(work, metadata)
    })
    it('calls `fse.outputFile` for %s', async () => {
      // Act
      await sut['_buildPackages']()

      // Assert
      expect(outputFile).toHaveBeenCalledTimes(3)
    })

    it('calls `PackageBuilder.buildPackage` for %s', async () => {
      // Act
      await sut['_buildPackages']()

      // Assert
      expect(mockBuildPackage).toHaveBeenCalledTimes(3)
    })
  })

  describe('process', () => {
    describe.each([
      [
        'different map',
        new Map([['a', new Set(['a'])]]),
        new Map([['d', new Set(['a'])]]),
        new Map([['d', new Set(['a'])]]),
      ],
      [
        'same map',
        new Map([['a', new Set(['a'])]]),
        new Map([['a', new Set(['a'])]]),
        new Map(),
      ],

      [
        'overlapping map',
        new Map([['a', new Set(['a'])]]),
        new Map([['a', new Set(['a', 'b'])]]),
        new Map([['a', new Set(['b'])]]),
      ],
    ])('when executed with %s', (_, additive, destructive, expectedDestructive) => {
      let sut
      beforeEach(async () => {
        // Arrange
        work.diffs.package = additive
        work.diffs.destructiveChanges = destructive
        work.config.output = 'test'
        sut = new PackageGenerator(work, metadata)

        await sut.process()
      })
      it('cleans up the maps', () => {
        // Assert
        expect(destructive).toEqual(expectedDestructive)
      })
      it('calls `fse.outputFile` for %s', () => {
        // Assert
        expect(outputFile).toHaveBeenCalledTimes(3)
      })

      it('calls `PackageBuilder.buildPackage` for %s', () => {
        // Assert
        expect(mockBuildPackage).toHaveBeenCalledTimes(3)
      })
    })
  })
})
