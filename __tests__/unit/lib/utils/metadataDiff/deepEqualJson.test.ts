'use strict'
import { describe, expect, it } from 'vitest'

import { deepEqualJson } from '../../../../../src/utils/metadataDiff/deepEqualJson'

describe('deepEqualJson', () => {
  describe('Given primitive inputs', () => {
    it('When two equal strings, Then returns true', () => {
      expect(deepEqualJson('abc', 'abc')).toBe(true)
    })

    it('When two different strings, Then returns false', () => {
      expect(deepEqualJson('abc', 'abd')).toBe(false)
    })

    it('When both undefined, Then returns true', () => {
      expect(deepEqualJson(undefined, undefined)).toBe(true)
    })

    it('When both null, Then returns true', () => {
      expect(deepEqualJson(null, null)).toBe(true)
    })

    it('When null and undefined, Then returns false', () => {
      expect(deepEqualJson(null, undefined)).toBe(false)
    })

    it('When two equal numbers, Then returns true', () => {
      expect(deepEqualJson(42, 42)).toBe(true)
    })

    it('When two different numbers, Then returns false', () => {
      expect(deepEqualJson(42, 43)).toBe(false)
    })

    it('When two equal booleans, Then returns true', () => {
      expect(deepEqualJson(true, true)).toBe(true)
    })

    it('When a string and a number with same value, Then returns false', () => {
      expect(deepEqualJson('42', 42)).toBe(false)
    })
  })

  describe('Given type mismatches', () => {
    it('When object and null, Then returns false', () => {
      expect(deepEqualJson({}, null)).toBe(false)
    })

    it('When null and object, Then returns false', () => {
      expect(deepEqualJson(null, {})).toBe(false)
    })

    it('When primitive and object, Then returns false', () => {
      expect(deepEqualJson('a', { 0: 'a' })).toBe(false)
    })

    it('When array and object with same keys count, Then returns false', () => {
      expect(deepEqualJson(['a'], { 0: 'a' })).toBe(false)
    })

    it('When object and array, Then returns false', () => {
      expect(deepEqualJson({ 0: 'a' }, ['a'])).toBe(false)
    })
  })

  describe('Given identical references', () => {
    it('When same object reference, Then short-circuits to true', () => {
      const o = { a: { b: 1 } }
      expect(deepEqualJson(o, o)).toBe(true)
    })

    it('When same array reference, Then short-circuits to true', () => {
      const a = [1, 2, [3]]
      expect(deepEqualJson(a, a)).toBe(true)
    })
  })

  describe('Given empty structures', () => {
    it('When both empty objects, Then returns true', () => {
      expect(deepEqualJson({}, {})).toBe(true)
    })

    it('When both empty arrays, Then returns true', () => {
      expect(deepEqualJson([], [])).toBe(true)
    })

    it('When empty object and empty array, Then returns false', () => {
      expect(deepEqualJson({}, [])).toBe(false)
    })
  })

  describe('Given arrays', () => {
    it('When equal-length arrays with same primitives, Then returns true', () => {
      expect(deepEqualJson([1, 2, 3], [1, 2, 3])).toBe(true)
    })

    it('When different-length arrays, Then returns false', () => {
      expect(deepEqualJson([1, 2], [1, 2, 3])).toBe(false)
    })

    it('When same-length arrays with differing element, Then returns false', () => {
      expect(deepEqualJson([1, 2, 3], [1, 9, 3])).toBe(false)
    })

    it('When arrays differ only in order, Then returns false (order-sensitive)', () => {
      expect(deepEqualJson([1, 2, 3], [3, 2, 1])).toBe(false)
    })

    it('When arrays of equal objects, Then returns true', () => {
      expect(deepEqualJson([{ a: 1 }, { b: 2 }], [{ a: 1 }, { b: 2 }])).toBe(
        true
      )
    })
  })

  describe('Given objects', () => {
    it('When two single-key objects with same value, Then returns true', () => {
      expect(deepEqualJson({ a: 1 }, { a: 1 })).toBe(true)
    })

    it('When two single-key objects with different values, Then returns false', () => {
      expect(deepEqualJson({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('When two objects with different key counts, Then returns false', () => {
      expect(deepEqualJson({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })

    it('When two objects with same key count but different keys, Then returns false', () => {
      expect(deepEqualJson({ a: 1 }, { b: 1 })).toBe(false)
    })

    it('When objects with same keys regardless of declaration order, Then returns true', () => {
      expect(deepEqualJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })
  })

  describe('Given nested structures (XML-like)', () => {
    it('When nested objects are structurally equal, Then returns true', () => {
      const a = { tag: { '@_id': 'x', child: ['v1', 'v2'] } }
      const b = { tag: { '@_id': 'x', child: ['v1', 'v2'] } }
      expect(deepEqualJson(a, b)).toBe(true)
    })

    it('When a nested array element differs, Then returns false', () => {
      const a = { tag: { child: ['v1', 'v2'] } }
      const b = { tag: { child: ['v1', 'v3'] } }
      expect(deepEqualJson(a, b)).toBe(false)
    })

    it('When deep nesting matches, Then returns true', () => {
      const a = { l1: { l2: { l3: { l4: { leaf: 'x' } } } } }
      const b = { l1: { l2: { l3: { l4: { leaf: 'x' } } } } }
      expect(deepEqualJson(a, b)).toBe(true)
    })
  })

  describe('Given the hasOwnProperty edge case', () => {
    it('When one object has a key with undefined value and the other has no such key (same length), Then returns false', () => {
      // Both have one key; "a" vs "b" — caught by hasOwnProperty guard
      expect(deepEqualJson({ a: undefined }, { b: undefined })).toBe(false)
    })

    it('When one side has an inherited (non-own) property matching the other side own key, Then returns false', () => {
      // Hardens against a `key in b` mutation: `in` would walk the prototype
      // chain and report `true` for inherited properties, defeating the
      // own-keys-only contract.
      const proto = { shared: 'inherited' }
      const a = { shared: 'inherited' }
      const bInherits = Object.create(proto) as Record<string, unknown>
      // bInherits has zero own keys; key counts differ → false even before the
      // hasOwn check. Add an own decoy to force same length without own match.
      bInherits['decoy'] = 'x'
      expect(deepEqualJson(a, bInherits)).toBe(false)
    })
  })
})
