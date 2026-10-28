'use strict'
import { beforeAll, describe, expect, it } from 'vitest'

import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { createTreeReader } from '../../../../src/adapter/treeReader'
import { TAB } from '../../../../src/constant/cliConstants'
import { MODIFICATION } from '../../../../src/constant/gitConstants'
import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import { CopyOperationKind } from '../../../../src/types/handlerResult'
import { expandComponentCopies } from '../../../../src/utils/componentCopies'
import { expandTypeDirCompanionCopies } from '../../../../src/utils/typeDirCompanionCopies'
import { getConfig, getContext } from '../../../__utils__/testWork'

const TO = 'to-sha'
const CHANGED_LINES = 4
const RESOURCE_ROOT = 'force-app/main/default/staticresources'
const FOLDER_FILES = Array.from(
  { length: CHANGED_LINES },
  (_, i) => `${RESOURCE_ROOT}/Lib/f${i}.js`
)
const META_FILE = `${RESOURCE_ROOT}/Lib.resource-meta.xml`
const COMPONENT_FILE_COUNT = FOLDER_FILES.length + 1
const OPERATIONS_PER_LINE = 3

describe('DiffLineInterpreter with resource components', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  const processChangedLines = async () => {
    const index = new TreeIndex()
    for (const path of [...FOLDER_FILES, META_FILE]) index.add(path)
    const trees = createTreeReader(new Map([[TO, index]]))
    const config = { ...getConfig(), to: TO, generateDelta: true }
    const sut = new DiffLineInterpreter(getContext({ config, metadata, trees }))
    const lines = FOLDER_FILES.map(path => `${MODIFICATION}${TAB}${path}`)
    return { result: await sut.process(lines), trees }
  }

  describe('Given a folder resource with several changed lines', () => {
    it('When process runs, Then it emits one component request per line', async () => {
      // Arrange & Act
      const { result } = await processChangedLines()

      // Assert
      const requests = result.copies.filter(
        op => op.kind === CopyOperationKind.GitComponentCopy
      )
      expect(requests).toHaveLength(CHANGED_LINES)
    })

    it('When process runs, Then it emits three operations per line', async () => {
      // Arrange & Act
      const { result } = await processChangedLines()

      // Assert
      expect(result.copies).toHaveLength(CHANGED_LINES * OPERATIONS_PER_LINE)
    })

    it('When the copies are expanded, Then they hold the repeated base copies plus one copy per component file', async () => {
      // Arrange
      const { result, trees } = await processChangedLines()

      // Act
      const expanded = expandComponentCopies(
        expandTypeDirCompanionCopies(result.copies, trees),
        trees
      )

      // Assert
      expect(expanded).toHaveLength(2 * CHANGED_LINES + COMPONENT_FILE_COUNT)
    })

    it('When the copies are expanded, Then they target only the component files', async () => {
      // Arrange
      const { result, trees } = await processChangedLines()

      // Act
      const expanded = expandComponentCopies(
        expandTypeDirCompanionCopies(result.copies, trees),
        trees
      )

      // Assert
      expect(new Set(expanded.map(op => op.path))).toEqual(
        new Set([...FOLDER_FILES, META_FILE])
      )
    })
  })
})
