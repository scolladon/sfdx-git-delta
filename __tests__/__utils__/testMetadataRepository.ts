'use strict'
import type { MetadataRepository } from '../../src/metadata/MetadataRepository'
import type { Metadata } from '../../src/types/metadata'

type MetadataRepositoryStub = Partial<MetadataRepository>

// Shared factory so a future addition to MetadataRepository breaks a single
// place instead of every hand-rolled mock in the test suite.
export const createMetadataRepositoryMock = (
  overrides: MetadataRepositoryStub = {}
): MetadataRepository => ({
  has: () => false,
  get: () => undefined,
  getByXmlName: () => undefined,
  getFullyQualifiedName: () => '',
  values: () => [],
  ...overrides,
})

export const createMetadataRepositoryFromTypes = (
  types: Metadata[]
): MetadataRepository => {
  const byDir = new Map<string, Metadata>()
  const byXmlName = new Map<string, Metadata>()
  for (const t of types) {
    if (t.directoryName) byDir.set(t.directoryName, t)
    if (t.xmlName) byXmlName.set(t.xmlName, t)
  }
  return createMetadataRepositoryMock({
    has: (path: string) => byDir.has(path.split('/').find(p => byDir.has(p))!),
    get: (path: string) => {
      const parts = path.split('/')
      for (const part of parts) {
        const found = byDir.get(part)
        if (found) return found
      }
      return undefined
    },
    getByXmlName: (xmlName: string) => byXmlName.get(xmlName),
    values: () => types,
  })
}
