'use strict'

// The push helpers return false on the first child pair already known to
// differ, so children are walked once rather than scanned then pushed.
const pushArrayChildPairs = (
  arrA: unknown[],
  arrB: unknown[],
  stackA: object[],
  stackB: object[]
): boolean => {
  const len = arrA.length
  if (len !== arrB.length) return false
  // Stryker disable next-line EqualityOperator -- `i <= len` is equivalent: both arrays have length len, so the extra pass reads arrA[len] and arrB[len], both undefined, and `va === vb` continues out of the loop (the object loop's twin is killable: keysA[len] is undefined and Object.hasOwn(objB, undefined) refuses). `i >= len` shares the mutator name; on a non-empty array it skips the loop exactly like the killed ConditionalExpression false-flip on this condition
  for (let i = 0; i < len; i++) {
    const va = arrA[i]
    const vb = arrB[i]
    if (va === vb) continue
    if (
      va === null ||
      vb === null ||
      typeof va !== 'object' ||
      typeof vb !== 'object'
    ) {
      return false
    }
    stackA.push(va as object)
    stackB.push(vb as object)
  }
  return true
}

const pushObjectChildPairs = (
  objA: Record<string, unknown>,
  objB: Record<string, unknown>,
  stackA: object[],
  stackB: object[]
): boolean => {
  const keysA = Object.keys(objA)
  const len = keysA.length
  if (len !== Object.keys(objB).length) return false
  for (let i = 0; i < len; i++) {
    const key = keysA[i] as string
    if (!Object.hasOwn(objB, key)) return false
    const va = objA[key]
    const vb = objB[key]
    if (va === vb) continue
    if (
      va === null ||
      vb === null ||
      typeof va !== 'object' ||
      typeof vb !== 'object'
    ) {
      return false
    }
    stackA.push(va as object)
    stackB.push(vb as object)
  }
  return true
}

/**
 * Iterative structural equality for JSON-like values (plain objects,
 * arrays, primitives). Order-sensitive for arrays. Replaces the narrow
 * surface of `fast-equals.deepEqual` that SGD actually used in
 * StreamingDiff.
 *
 * Out of scope (txml never emits these): Date, RegExp, Map, Set, Symbol,
 * Function, circular references, NaN. Falls back to `===` for any
 * non-plain-object value.
 *
 * Hot-path optimisations:
 *  - Reference-equality short-circuit before any allocation
 *  - Iterative work-stack — no recursion frames
 *  - Parallel A/B stacks — no per-pair tuple allocation
 *  - Inline scalar comparison inside the per-child loops — string/number
 *    leaves never reach the work stack (the dominant case in XML diffs)
 *  - Indexed for-loops with cached length over `for…of`
 */
export const deepEqualJson = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false
  }

  // Parallel stacks: each push to stackA matches a push to stackB. Two
  // arrays of pointers cost less than one array of [a, b] tuples both in
  // allocation and in cache locality at pop time.
  const stackA: object[] = [a as object]
  const stackB: object[] = [b as object]

  while (stackA.length !== 0) {
    // Invariant: every push site filters `va === vb` first, so popped pairs
    // are always non-identical references. No inline `===` short-circuit
    // needed inside the loop.
    const ai = stackA.pop() as object
    const bi = stackB.pop() as object

    const aIsArr = Array.isArray(ai)
    if (aIsArr !== Array.isArray(bi)) return false
    const childrenMatch = aIsArr
      ? pushArrayChildPairs(ai as unknown[], bi as unknown[], stackA, stackB)
      : pushObjectChildPairs(
          ai as Record<string, unknown>,
          bi as Record<string, unknown>,
          stackA,
          stackB
        )
    if (!childrenMatch) return false
  }

  return true
}
