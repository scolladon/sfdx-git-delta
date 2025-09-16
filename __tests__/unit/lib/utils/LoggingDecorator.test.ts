'use strict'

import {
  hasCustomToString,
  stringify,
} from '../../../../src/utils/LoggingDecorator.js'

describe('LoggingDecorator', () => {
  describe('hasCustomToString', () => {
    // Objects with custom toString
    it('should return true for objects with custom toString', () => {
      const obj = {
        toString: () => 'custom',
      }
      expect(hasCustomToString(obj)).toBe(true)
    })

    it('should return true for class instances with custom toString', () => {
      class CustomClass {
        toString() {
          return 'custom'
        }
      }
      expect(hasCustomToString(new CustomClass())).toBe(true)
    })

    // Objects without custom toString
    it('should return false for plain objects', () => {
      expect(hasCustomToString({})).toBe(false)
    })

    it('should return false for class instances without custom toString', () => {
      class PlainClass {}
      expect(hasCustomToString(new PlainClass())).toBe(false)
    })

    // Edge cases
    it('should return false for null', () => {
      expect(hasCustomToString(null)).toBe(false)
    })

    it('should return false for undefined', () => {
      expect(hasCustomToString(undefined)).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(hasCustomToString(42)).toBe(false)
      expect(hasCustomToString('string')).toBe(false)
      expect(hasCustomToString(true)).toBe(false)
      expect(hasCustomToString(Symbol())).toBe(false)
    })

    // Special cases
    it('should return true for objects with own toString property', () => {
      const obj = Object.create(null)
      obj.toString = () => 'custom'
      expect(hasCustomToString(obj)).toBe(true)
    })

    it('should return false for objects with non-function toString', () => {
      const obj = { toString: 'not a function' }
      expect(hasCustomToString(obj)).toBe(false)
    })

    it('should return true for Date objects (considered as having custom toString)', () => {
      expect(hasCustomToString(new Date())).toBe(true)
    })

    it('should return true for Array objects (considered as having custom toString)', () => {
      expect(hasCustomToString([])).toBe(true)
    })

    it('should return true for objects with prototype chain toString', () => {
      const parent = { toString: () => 'parent' }
      const child = Object.create(parent)
      expect(hasCustomToString(child)).toBe(true)
    })

    // Additional test cases
    it('should return true for Error objects', () => {
      expect(hasCustomToString(new Error('test'))).toBe(true)
    })

    it('should handle objects with Symbol.toStringTag', () => {
      const obj = {
        [Symbol.toStringTag]: 'Test',
        toString: () => 'custom',
      }
      expect(hasCustomToString(obj)).toBe(true)
    })

    it('should work with Proxy objects', () => {
      const target = { toString: () => 'proxy target' }
      const proxy = new Proxy(target, {})
      expect(hasCustomToString(proxy)).toBe(true)
    })

    it('should return false for objects with only Symbol.toStringTag', () => {
      const obj = { [Symbol.toStringTag]: 'Test' }
      expect(hasCustomToString(obj)).toBe(false)
    })

    // Prototype-less object tests
    it('should return false for prototype-less objects without toString', () => {
      const obj = Object.create(null)
      expect(hasCustomToString(obj)).toBe(false)
    })

    it('should return true for prototype-less objects with added toString', () => {
      const obj = Object.create(null)
      obj.toString = () => 'custom'
      expect(hasCustomToString(obj)).toBe(true)
    })

    it('should handle prototype-less objects with non-function toString', () => {
      const obj = Object.create(null)
      obj.toString = 'not a function'
      expect(hasCustomToString(obj)).toBe(false)
    })

    it('should handle prototype-less objects with inherited toString', () => {
      const parent = Object.create(null)
      parent.toString = () => 'parent'
      const child = Object.create(parent)
      expect(hasCustomToString(child)).toBe(true)
    })

    it('should return false for objects with null prototype and no toString', () => {
      const obj = Object.create(null)
      expect(hasCustomToString(obj)).toBe(false)
      expect(Object.getPrototypeOf(obj)).toBeNull()
    })

    it('should handle objects with null prototype chain', () => {
      const obj = Object.create(null)
      expect(hasCustomToString(obj)).toBe(false)
    })
  })

  describe('stringify', () => {
    it('should convert Map to array of entries', () => {
      const map = new Map()
      map.set('key1', 'value1')
      map.set('key2', 'value2')

      const result = stringify(map)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual([
        ['key1', 'value1'],
        ['key2', 'value2'],
      ])
    })

    it('should convert Set to array', () => {
      const set = new Set(['value1', 'value2', 'value3'])

      const result = stringify(set)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual(['value1', 'value2', 'value3'])
    })

    it('should handle nested Map and Set structures', () => {
      const nestedMap = new Map()
      const innerSet = new Set(['a', 'b', 'c'])
      nestedMap.set('set', innerSet)
      nestedMap.set('primitive', 42)

      const result = stringify(nestedMap)
      const parsed = JSON.parse(result)

      expect(parsed).toEqual([
        ['set', ['a', 'b', 'c']],
        ['primitive', 42],
      ])
    })

    it('should handle Map with complex key types', () => {
      const map = new Map()
      map.set({ id: 1 }, 'object key')
      map.set(42, 'number key')

      const result = stringify(map)
      const parsed = JSON.parse(result)

      // Map keys that are objects are stringified in the result
      expect(parsed.length).toBe(2)
      expect(parsed[1]).toEqual([42, 'number key'])
    })

    it('should handle empty Map and Set', () => {
      const emptyMap = new Map()
      const emptySet = new Set()

      expect(stringify(emptyMap)).toBe('[]')
      expect(stringify(emptySet)).toBe('[]')
    })
  })
})
