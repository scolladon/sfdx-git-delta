'use strict'

import {
  hasCustomToString,
  stringify,
} from '../../../../src/utils/LoggingDecorator.js'

describe('LoggingDecorator', () => {
  describe('hasCustomToString', () => {
    describe('when object has custom toString', () => {
      it('should return true for objects with custom toString method', () => {
        // Arrange
        const obj = {
          toString: () => 'custom',
        }

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for class instances with custom toString method', () => {
        // Arrange
        class CustomClass {
          toString() {
            return 'custom'
          }
        }
        const sut = new CustomClass()

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for objects with own toString property', () => {
        // Arrange
        const obj = Object.create(null)
        obj.toString = () => 'custom'

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for Date objects', () => {
        // Arrange
        const sut = new Date()

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for Array objects', () => {
        // Arrange
        const sut: Array<any> = []

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for objects with prototype chain toString', () => {
        // Arrange
        const parent = { toString: () => 'parent' }
        const sut = Object.create(parent)

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for Error objects', () => {
        // Arrange
        const sut = new Error('test')

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for objects with Symbol.toStringTag and toString', () => {
        // Arrange
        const obj = {
          [Symbol.toStringTag]: 'Test',
          toString: () => 'custom',
        }

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for Proxy objects', () => {
        // Arrange
        const target = { toString: () => 'proxy target' }
        const sut = new Proxy(target, {})

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for prototype-less objects with added toString', () => {
        // Arrange
        const obj = Object.create(null)
        obj.toString = () => 'custom'

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(true)
      })

      it('should return true for prototype-less objects with inherited toString', () => {
        // Arrange
        const parent = Object.create(null)
        parent.toString = () => 'parent'
        const sut = Object.create(parent)

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(true)
      })
    })

    describe('when object does not have custom toString', () => {
      it('should return false for plain objects', () => {
        // Arrange
        const sut = {}

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for class instances without custom toString', () => {
        // Arrange
        class PlainClass {}
        const sut = new PlainClass()

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for objects with non-function toString', () => {
        // Arrange
        const obj = { toString: 'not a function' }

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for objects with only Symbol.toStringTag', () => {
        // Arrange
        const obj = { [Symbol.toStringTag]: 'Test' }

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for prototype-less objects without toString', () => {
        // Arrange
        const sut = Object.create(null)

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for prototype-less objects with non-function toString', () => {
        // Arrange
        const obj = Object.create(null)
        obj.toString = 'not a function'

        // Act
        const result = hasCustomToString(obj)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for objects with null prototype and no toString', () => {
        // Arrange
        const sut = Object.create(null)

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
        expect(Object.getPrototypeOf(sut)).toBeNull()
      })

      it('should return false for objects with null prototype chain', () => {
        // Arrange
        const sut = Object.create(null)

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
      })
    })

    describe('when given edge cases', () => {
      it('should return false for null', () => {
        // Arrange
        const sut = null

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for undefined', () => {
        // Arrange
        const sut = undefined

        // Act
        const result = hasCustomToString(sut)

        // Assert
        expect(result).toBe(false)
      })

      it('should return false for primitives', () => {
        // Arrange & Act & Assert
        expect(hasCustomToString(42)).toBe(false)
        expect(hasCustomToString('string')).toBe(false)
        expect(hasCustomToString(true)).toBe(false)
        expect(hasCustomToString(Symbol())).toBe(false)
      })
    })
  })

  describe('stringify', () => {
    describe('when given a Map', () => {
      it('should convert Map to array of entries', () => {
        // Arrange
        const sut = new Map()
        sut.set('key1', 'value1')
        sut.set('key2', 'value2')

        // Act
        const result = stringify(sut)
        const parsed = JSON.parse(result)

        // Assert
        expect(parsed).toEqual([
          ['key1', 'value1'],
          ['key2', 'value2'],
        ])
      })

      it('should handle empty Map', () => {
        // Arrange
        const sut = new Map()

        // Act
        const result = stringify(sut)

        // Assert
        expect(result).toBe('[]')
      })

      it('should handle Map with complex key types', () => {
        // Arrange
        const sut = new Map()
        sut.set({ id: 1 }, 'object key')
        sut.set(42, 'number key')

        // Act
        const result = stringify(sut)
        const parsed = JSON.parse(result)

        // Assert
        expect(parsed.length).toBe(2)
        expect(parsed[1]).toEqual([42, 'number key'])
      })
    })

    describe('when given a Set', () => {
      it('should convert Set to array', () => {
        // Arrange
        const sut = new Set(['value1', 'value2', 'value3'])

        // Act
        const result = stringify(sut)
        const parsed = JSON.parse(result)

        // Assert
        expect(parsed).toEqual(['value1', 'value2', 'value3'])
      })

      it('should handle empty Set', () => {
        // Arrange
        const sut = new Set()

        // Act
        const result = stringify(sut)

        // Assert
        expect(result).toBe('[]')
      })
    })

    describe('when given nested structures', () => {
      it('should handle nested Map and Set structures', () => {
        // Arrange
        const sut = new Map()
        const innerSet = new Set(['a', 'b', 'c'])
        sut.set('set', innerSet)
        sut.set('primitive', 42)

        // Act
        const result = stringify(sut)
        const parsed = JSON.parse(result)

        // Assert
        expect(parsed).toEqual([
          ['set', ['a', 'b', 'c']],
          ['primitive', 42],
        ])
      })
    })
  })
})
