'use strict'
import { outputFile } from 'fs-extra'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import ChangesManifestProcessor from '../../../../src/post-processor/changesManifestProcessor'
import { ChangeKind } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

vi.mock('fs-extra')

describe('ChangesManifestProcessor', () => {
  let work: Work
  // ChangesManifestProcessor never reads the metadata registry — a stub keeps
  // the test suite fast without loading the real registry on every beforeEach.
  const metadata = {} as MetadataRepository
  beforeEach(() => {
    work = getWork()
  })

  describe('Given changes-manifest flag is not set', () => {
    it('When process runs, Then writes no file', async () => {
      // Arrange
      work.config.changesManifest = undefined
      const sut = new ChangesManifestProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given changes-manifest is an already-resolved relative path', () => {
    it('When process runs, Then writes to that path verbatim with the kind-grouped payload', async () => {
      // Arrange — the CLI layer resolves bare flag + relative path policy
      // before this processor sees config.changesManifest.
      work.config.changesManifest = 'reports/changes.json'
      work.changes.add(ChangeKind.Add, 'ApexClass', 'NewClass')
      work.changes.add(ChangeKind.Modify, 'ApexClass', 'EditedClass')
      work.changes.add(ChangeKind.Delete, 'ApexTrigger', 'OldTrigger')
      const sut = new ChangesManifestProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(outputFile).toHaveBeenCalledTimes(1)
      const [path, payload] = vi.mocked(outputFile).mock.calls[0]
      expect(path).toBe('reports/changes.json')
      expect(JSON.parse(payload as string)).toEqual({
        add: { ApexClass: ['NewClass'] },
        modify: { ApexClass: ['EditedClass'] },
        delete: { ApexTrigger: ['OldTrigger'] },
        rename: {},
      })
    })
  })

  describe('Given changes-manifest is an absolute path', () => {
    it('When process runs, Then writes to that absolute path verbatim', async () => {
      // Arrange
      work.config.changesManifest = '/tmp/sgd-review.json'
      const sut = new ChangesManifestProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(outputFile).toHaveBeenCalledTimes(1)
      const [path] = vi.mocked(outputFile).mock.calls[0]
      expect(path).toBe('/tmp/sgd-review.json')
    })
  })

  describe('Given rename pairs recorded on the ChangeSet', () => {
    it('When process runs, Then the rename bucket is emitted as {type: [{from, to}]} with to-sorted order, and rename participants are excluded from add/delete', async () => {
      // Arrange
      work.config.changesManifest = 'changes.json'
      work.changes.add(ChangeKind.Add, 'ApexClass', 'ZetaNew')
      work.changes.add(ChangeKind.Delete, 'ApexClass', 'ZetaOld')
      work.changes.recordRename('ApexClass', 'ZetaOld', 'ZetaNew')
      work.changes.recordRename('ApexClass', 'AlphaOld', 'AlphaNew')
      const sut = new ChangesManifestProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      const [, payload] = vi.mocked(outputFile).mock.calls[0]
      const parsed = JSON.parse(payload as string)
      expect(parsed.rename).toEqual({
        ApexClass: [
          { from: 'AlphaOld', to: 'AlphaNew' },
          { from: 'ZetaOld', to: 'ZetaNew' },
        ],
      })
      expect(parsed.add).toEqual({})
      expect(parsed.delete).toEqual({})
    })
  })

  describe('Given multiple types and members across kinds', () => {
    it('When process runs, Then serialises with deterministic alphabetical sort', async () => {
      // Arrange
      work.config.changesManifest = 'changes.json'
      work.changes.add(ChangeKind.Add, 'CustomObject', 'Beta__c')
      work.changes.add(ChangeKind.Add, 'CustomObject', 'Alpha__c')
      work.changes.add(ChangeKind.Add, 'ApexClass', 'Zeta')
      work.changes.add(ChangeKind.Add, 'ApexClass', 'Alpha')
      const sut = new ChangesManifestProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      const [, payload] = vi.mocked(outputFile).mock.calls[0]
      const parsed = JSON.parse(payload as string)
      expect(Object.keys(parsed.add)).toEqual(['ApexClass', 'CustomObject'])
      expect(parsed.add.ApexClass).toEqual(['Alpha', 'Zeta'])
      expect(parsed.add.CustomObject).toEqual(['Alpha__c', 'Beta__c'])
    })
  })

  describe('Given renames across multiple types registered in non-alphabetical order', () => {
    it('When process runs, Then the rename bucket keys are emitted in alphabetical order', async () => {
      // Arrange — verify the type-key sort on the rename bucket; without the
      // .sort() call the order would mirror Map-insertion order (Z then A).
      work.config.changesManifest = 'changes.json'
      work.changes.recordRename('ZetaType', 'z.old', 'z.new')
      work.changes.recordRename('AlphaType', 'a.old', 'a.new')
      const sut = new ChangesManifestProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      const [, payload] = vi.mocked(outputFile).mock.calls[0]
      const parsed = JSON.parse(payload as string)
      expect(Object.keys(parsed.rename)).toEqual(['AlphaType', 'ZetaType'])
    })
  })
})
