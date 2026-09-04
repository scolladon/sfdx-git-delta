import { describe } from 'vitest'
import { deepEqualJson } from '../../src/utils/metadataDiff/deepEqualJson.js'
import { perfBench } from './harness/perfBench.js'

// XML-shaped fixtures matching txml output: nested objects with @_attr
// keys and arrays of repeated tags. The diff hot path compares
// (fromElem, toElem) and (fromArr, toArr) of this shape.
const buildElement = (i: number): Record<string, unknown> => ({
  '@_id': `id-${i}`,
  fullName: `Label_${i}`,
  language: 'en_US',
  protected: 'false',
  shortDescription: `Short_${i}`,
  value: `Some value ${i} with spaces`,
})

const buildNestedElement = (i: number): Record<string, unknown> => ({
  '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
  fullName: `Profile_${i}`,
  fieldPermissions: Array.from({ length: 10 }, (_, j) => ({
    editable: 'true',
    field: `Account.Field_${j}__c`,
    readable: 'true',
  })),
  objectPermissions: Array.from({ length: 5 }, (_, j) => ({
    allowCreate: 'true',
    allowDelete: 'false',
    allowEdit: 'true',
    object: `Object_${j}__c`,
  })),
  userLicense: 'Salesforce',
})

// Shallow scalar-heavy element (the most common XML diff input)
const shallowA = buildElement(0)
const shallowB = buildElement(0)
const shallowDifferent = { ...buildElement(0), value: 'different' }

// Deeply nested with arrays (Profile-shape)
const nestedA = buildNestedElement(0)
const nestedB = buildNestedElement(0)
const nestedDifferent = {
  ...buildNestedElement(0),
  fieldPermissions: [
    ...(buildNestedElement(0).fieldPermissions as Record<string, unknown>[]),
    { editable: 'true', field: 'Extra', readable: 'true' },
  ],
}

// Array-of-elements (drainArrays hot path)
const arrayA = Array.from({ length: 100 }, (_, i) => buildElement(i))
const arrayB = Array.from({ length: 100 }, (_, i) => buildElement(i))
const arrayDifferentLast = (() => {
  const out = arrayA.map(e => ({ ...e }))
  out[99] = { ...(out[99] as Record<string, unknown>), value: 'changed' }
  return out
})()

describe('deepEqualJson-equal-shallow', () => {
  perfBench('shallow-equal', () => {
    deepEqualJson(shallowA, shallowB)
  })
})

describe('deepEqualJson-different-shallow', () => {
  perfBench('shallow-different-last-field', () => {
    deepEqualJson(shallowA, shallowDifferent)
  })
})

describe('deepEqualJson-equal-nested', () => {
  perfBench('nested-equal', () => {
    deepEqualJson(nestedA, nestedB)
  })
})

describe('deepEqualJson-different-nested', () => {
  perfBench('nested-different-array-length', () => {
    deepEqualJson(nestedA, nestedDifferent)
  })
})

describe('deepEqualJson-equal-large-array', () => {
  perfBench('array-of-100-elements-equal', () => {
    deepEqualJson(arrayA, arrayB)
  })
})

describe('deepEqualJson-different-large-array', () => {
  perfBench('array-of-100-elements-last-differs', () => {
    deepEqualJson(arrayA, arrayDifferentLast)
  })
})

describe('deepEqualJson-reference-identical', () => {
  perfBench('same-reference-short-circuit', () => {
    deepEqualJson(arrayA, arrayA)
  })
})
