'use strict'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { TreeIndex } from '../../../../src/adapter/treeIndex'
import { createTreeReader } from '../../../../src/adapter/treeReader'
import { TAB } from '../../../../src/constant/cliConstants'
import { MODIFICATION } from '../../../../src/constant/gitConstants'
import type { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import DiffLineInterpreter from '../../../../src/service/diffLineInterpreter'
import { expandComponentCopies } from '../../../../src/utils/componentCopies'
import { expandTypeDirCompanionCopies } from '../../../../src/utils/typeDirCompanionCopies'
import { getConfig, getContext } from '../../../__utils__/testWork'

const TO = 'to-sha'
const DOCUMENTS = 'force-app/main/default/documents'
const FOLDER = `${DOCUMENTS}/bulk`
const FOLDER_DESCRIPTOR = `${DOCUMENTS}/bulk.documentFolder-meta.xml`
const CHANGED_DOCUMENTS = 4
const ONE_LISTING = 1

const documentFiles = (i: number): string[] => [
  `${FOLDER}/doc${i}.png`,
  `${FOLDER}/doc${i}.document-meta.xml`,
]
const changedDocuments = Array.from({ length: CHANGED_DOCUMENTS }, (_, i) =>
  documentFiles(i)
)

describe('Given several changed documents in one folder', () => {
  let metadata: MetadataRepository
  beforeAll(async () => {
    metadata = await getDefinition({})
  })

  const run = async (lines: string[]) => {
    const index = new TreeIndex()
    for (const path of [FOLDER_DESCRIPTOR, ...changedDocuments.flat()]) {
      index.add(path)
    }
    const trees = createTreeReader(new Map([[TO, index]]))
    const listings = vi.spyOn(trees, 'filesUnder')
    const config = { ...getConfig(), to: TO, generateDelta: true }
    const sut = new DiffLineInterpreter(getContext({ config, metadata, trees }))
    const result = await sut.process(
      lines.map(path => `${MODIFICATION}${TAB}${path}`)
    )
    expandComponentCopies(
      expandTypeDirCompanionCopies(result.copies, trees),
      trees
    )
    return (dir: string) =>
      listings.mock.calls.filter(([, paths]) => paths === dir).length
  }

  it('When process and expansion run, Then the folder is listed once', async () => {
    // Arrange
    const lines = changedDocuments.map(([content]) => content!)

    // Act
    const listingsOf = await run(lines)

    // Assert
    expect(listingsOf(FOLDER)).toBe(ONE_LISTING)
  })

  it('When the folder descriptor changes too, Then the folder and the type directory are each listed once', async () => {
    // Arrange
    const lines = [
      FOLDER_DESCRIPTOR,
      ...changedDocuments.map(([content]) => content!),
    ]

    // Act
    const listingsOf = await run(lines)

    // Assert
    expect(listingsOf(FOLDER)).toBe(ONE_LISTING)
    expect(listingsOf(DOCUMENTS)).toBe(ONE_LISTING)
  })
})
