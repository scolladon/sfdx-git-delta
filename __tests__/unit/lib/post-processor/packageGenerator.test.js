'use strict'
const PackageGenerator = require('../../../../src/post-processor/packageGenerator')
const fse = require('fs-extra')
jest.mock('fs-extra')

const mockBuildPackage = jest.fn()
jest.mock('../../../../src/utils/packageHelper', () => {
  return jest.fn().mockImplementation(() => {
    return { buildPackage: mockBuildPackage }
  })
})

describe('PackageGenerator', () => {
  describe('cleanPackages', () => {
    describe('when destructive contains element from additive', () => {
      it('removes same element from destructive', () => {
        // Arrange
        const type = 'type'
        const element = 'element'
        const additive = new Map([[type, new Set([element])]])
        const destructive = new Map([[type, new Set([element, 'other'])]])
        const sut = new PackageGenerator({
          diffs: { package: additive, destructiveChanges: destructive },
          config: { output: 'test' },
        })

        // Act
        sut.cleanPackages()

        // Assert
        expect(additive.get(type).has(element)).toEqual(true)
        expect(destructive.get(type).has(element)).toEqual(false)
      })

      describe('when destructive does not have element anymore', () => {
        it('removes same element from destructive', () => {
          // Arrange
          const type = 'type'
          const element = 'element'
          const additive = new Map([[type, new Set([element])]])
          const destructive = new Map([[type, new Set([element])]])
          const sut = new PackageGenerator(
            {
              diffs: { package: additive, destructiveChanges: destructive },
            },
            { output: 'test' }
          )

          // Act
          sut.cleanPackages()

          // Assert
          expect(additive.get(type).has(element)).toEqual(true)
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
        const sut = new PackageGenerator({
          diffs: { package: additive, destructiveChanges: destructive },
          config: { output: 'test' },
        })

        // Act
        sut.cleanPackages()

        // Assert
        expect(additive.get(type).has(element)).toEqual(true)
        expect(destructive.get(type).has('otherElement')).toEqual(true)
      })
    })
  })

  describe('buildPackages', () => {
    let sut
    beforeEach(() => {
      // Arrange
      sut = new PackageGenerator({
        diffs: { package: new Map(), destructiveChanges: new Map() },
        config: { output: 'test' },
      })
    })
    it('calls `fse.outputFile` for %s', async () => {
      // Act
      await sut.buildPackages()

      // Assert
      expect(fse.outputFile).toHaveBeenCalledTimes(3)
    })

    it('calls `PackageBuilder.buildPackage` for %s', async () => {
      // Act
      await sut.buildPackages()

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
    ])(
      'when executed with %s',
      (_, additive, destructive, expectedDestructive) => {
        let sut
        beforeEach(async () => {
          // Arrange
          sut = new PackageGenerator({
            diffs: { package: additive, destructiveChanges: destructive },

            config: { output: 'test' },
          })

          await sut.process()
        })
        it('cleans up the maps', () => {
          // Assert
          expect(destructive).toEqual(expectedDestructive)
        })
        it('calls `fse.outputFile` for %s', () => {
          // Assert
          expect(fse.outputFile).toHaveBeenCalledTimes(3)
        })

        it('calls `PackageBuilder.buildPackage` for %s', () => {
          // Assert
          expect(mockBuildPackage).toHaveBeenCalledTimes(3)
        })
      }
    )
  })
})
