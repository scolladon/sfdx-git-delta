'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { EMPTY_TREE_INDEXES } from '../../../../src/adapter/treeIndexes'
import { DELETION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import FlowHandler from '../../../../src/service/flowHandler'
import type { Config } from '../../../../src/types/config'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const objectType = {
  directoryName: 'flows',
  inFolder: false,
  metaFile: false,
  suffix: 'flow',
  xmlName: 'Flow',
}
const basePath = `force-app/main/default/${objectType.directoryName}`
let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
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
      const sut = new FlowHandler(
        changeType,
        element,
        config,
        EMPTY_TREE_INDEXES
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toHaveLength(1)
      expect(elementsOf(result)[0].target).toBe(
        ManifestTarget.DestructiveChanges
      )
      expect(elementsOf(result)[0].type).toBe('Flow')
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('MyFlow')
    })
  })
})
