'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import FlowHandler from '../../../../src/service/flowHandler'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const objectType = {
  directoryName: 'flows',
  inFolder: false,
  metaFile: false,
  suffix: 'flow',
  xmlName: 'Flow',
}
const basePath = `force-app/main/default/${objectType.directoryName}`
let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  work = getWork()
})

describe('flowHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })
  describe('collect', () => {
    it('Given flow deletion, When collect, Then returns destructive manifest with warning', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `${DELETION}       ${basePath}/MyFlow.${objectType.suffix}-meta.xml`,
        objectType,
        globalMetadata
      )
      const sut = new FlowHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toHaveLength(1)
      expect(result.changes.toElements()[0].target).toBe(
        ManifestTarget.DestructiveChanges
      )
      expect(result.changes.toElements()[0].type).toBe('Flow')
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('MyFlow')
    })
  })
})
