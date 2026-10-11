'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import { comparisonName } from '../../../../src/utils/comparisonName'

const TAB = '\t'

describe('Given comparisonName', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  it.each([
    ['a class', `A${TAB}force-app/main/default/classes/Foo.cls`],
    [
      'a decomposed label',
      `A${TAB}force-app/main/default/labels/CustomLabels.labels-meta.xml`,
    ],
    [
      'a field',
      `A${TAB}force-app/main/default/objects/Account/fields/My__c.field-meta.xml`,
    ],
  ])(
    'When the line is %s, Then it is the lower-cased fully qualified name',
    (_title, line) => {
      // Arrange
      const expected = metadata.getFullyQualifiedName(line).toLowerCase()

      // Act
      const result = comparisonName(metadata, line)

      // Assert
      expect(result).toBe(expected)
    }
  )
})
