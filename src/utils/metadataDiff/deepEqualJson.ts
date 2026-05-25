'use strict'

/**
 * Recursive structural equality for plain JSON-like values produced by
 * txml + txmlAdapter (primitives, plain objects, arrays). Order-sensitive
 * for arrays. Replaces the narrow surface of `fast-equals.deepEqual` that
 * SGD actually used in StreamingDiff.
 *
 * Out of scope (txml never emits these): Date, RegExp, Map, Set, Symbol,
 * Function, circular references, NaN. Falls back to `===` for any
 * non-plain-object value.
 */
export const deepEqualJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (typeof a !== 'object' || a === null) return false
  if (typeof b !== 'object' || b === null) return false
  const aIsArray = Array.isArray(a)
  const bIsArray = Array.isArray(b)
  if (aIsArray !== bIsArray) return false
  if (aIsArray && bIsArray) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualJson(a[i], b[i])) return false
    }
    return true
  }
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const key of keysA) {
    if (
      !Object.hasOwn(b, key) ||
      !deepEqualJson(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    ) {
      return false
    }
  }
  return true
}
