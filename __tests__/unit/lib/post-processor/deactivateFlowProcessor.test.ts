'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import {
  FLOW_DEFINITION_TYPE,
  FLOW_XML_NAME,
} from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import DeactivateFlowProcessor from '../../../../src/post-processor/deactivateFlowProcessor'
import type { Work } from '../../../../src/types/work'
import { readDir } from '../../../../src/utils/fsHelper'
import { treatPathSep } from '../../../../src/utils/fsUtils'
import { getGlobalMetadata, getWork } from '../../../__utils__/globalTestHelper'

jest.mock('fs-extra')
jest.mock('../../../../src/utils/fsHelper')
jest.mock('../../../../src/utils/fsUtils')

const mockedReadDir = jest.mocked(readDir)
const mockTreatPathSep = jest.mocked(treatPathSep)
mockTreatPathSep.mockImplementation(data => data)

const flowFullName = 'test-flow-to-be-deleted'

describe('DeactivateFlowProcessor', () => {
  let work: Work
  let metadata: MetadataRepository

  beforeAll(async () => {
    metadata = await getGlobalMetadata()
  })

  describe('process', () => {
    let processor: DeactivateFlowProcessor
    beforeEach(() => {
      work = getWork()
      processor = new DeactivateFlowProcessor(work, metadata)
    })

    describe('when no Flow has been deleted', () => {
      it('should not do anything', async () => {
        // Act
        await processor.process()

        // Assert
        expect(mockedReadDir).not.toHaveBeenCalled()
        expect(work.diffs.destructiveChanges.has(FLOW_XML_NAME)).toBeFalsy()
        expect(work.diffs.package.has(FLOW_DEFINITION_TYPE)).toBeFalsy()
      })
    })

    describe('when generateDelta config is false', () => {
      it('should not do anything', async () => {
        // Act
        await processor.process()

        // Assert
        expect(mockedReadDir).not.toHaveBeenCalled()
        expect(work.diffs.destructiveChanges.has(FLOW_XML_NAME)).toBeFalsy()
      })
    })

    describe('when a Flow has been deleted and generateDelta config is true', () => {
      beforeEach(() => {
        // Arrange
        work.config.generateDelta = true
        work.diffs.destructiveChanges = new Map([
          [FLOW_XML_NAME, new Set([flowFullName])],
        ])
      })
      it.todo('should remove the Flow from destructiveChanges.xml')
      it.todo('should add the Flow as FlowDefinition to package.xml')
      it.todo('should generate the FlowDefinition metadata file')
    })
  })
})
