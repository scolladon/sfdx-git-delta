'use strict'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import ChangesManifestProcessor from '../../../../src/post-processor/changesManifestProcessor'
import type { Config } from '../../../../src/types/config'
import { ChangeKind } from '../../../../src/types/handlerResult'
import ChangeSet from '../../../../src/utils/changeSet'
import { outputFile } from '../../../../src/utils/fsUtils'
import { addChange, addRename } from '../../../__utils__/handlerResultView'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsUtils', async orig => ({
  ...(await orig<typeof import('../../../../src/utils/fsUtils')>()),
  outputFile: vi.fn(),
}))

describe('ChangesManifestProcessor', () => {
  let config: Config
  let changes: ChangeSet
  // ChangesManifestProcessor never reads the metadata registry — a stub keeps
  // the test suite fast without loading the real registry on every beforeEach.
  const metadata = {} as MetadataRepository
  beforeEach(() => {
    config = getConfig()
    changes = new ChangeSet()
  })

  describe('Given changes-manifest flag is not set', () => {
    it('When process runs, Then writes no file', async () => {
      // Arrange
      config.changesManifest = undefined
      const sut = new ChangesManifestProcessor(getContext({ config, metadata }))

      // Act
      await sut.process(changes)

      // Assert
      expect(outputFile).not.toHaveBeenCalled()
    })
  })

  describe('Given changes-manifest is an already-resolved relative path', () => {
    it('When process runs, Then writes to that path verbatim with the kind-grouped payload', async () => {
      // Arrange — the CLI layer resolves bare flag + relative path policy
      // before this processor sees config.changesManifest.
      config.changesManifest = 'reports/changes.json'
      changes = addChange(changes, ChangeKind.Add, 'ApexClass', 'NewClass')
      changes = addChange(
        changes,
        ChangeKind.Modify,
        'ApexClass',
        'EditedClass'
      )
      changes = addChange(
        changes,
        ChangeKind.Delete,
        'ApexTrigger',
        'OldTrigger'
      )
      const sut = new ChangesManifestProcessor(getContext({ config, metadata }))

      // Act
      await sut.process(changes)

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
      config.changesManifest = '/tmp/sgd-review.json'
      const sut = new ChangesManifestProcessor(getContext({ config, metadata }))

      // Act
      await sut.process(changes)

      // Assert
      expect(outputFile).toHaveBeenCalledTimes(1)
      const [path] = vi.mocked(outputFile).mock.calls[0]
      expect(path).toBe('/tmp/sgd-review.json')
    })
  })

  describe('Given rename pairs recorded on the ChangeSet', () => {
    it('When process runs, Then the rename bucket is emitted as {type: [{from, to}]} with to-sorted order, and rename participants are excluded from add/delete', async () => {
      // Arrange
      config.changesManifest = 'changes.json'
      changes = addChange(changes, ChangeKind.Add, 'ApexClass', 'ZetaNew')
      changes = addChange(changes, ChangeKind.Delete, 'ApexClass', 'ZetaOld')
      changes = addRename(changes, 'ApexClass', 'ZetaOld', 'ZetaNew')
      changes = addRename(changes, 'ApexClass', 'AlphaOld', 'AlphaNew')
      const sut = new ChangesManifestProcessor(getContext({ config, metadata }))

      // Act
      await sut.process(changes)

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
      config.changesManifest = 'changes.json'
      changes = addChange(changes, ChangeKind.Add, 'CustomObject', 'Beta__c')
      changes = addChange(changes, ChangeKind.Add, 'CustomObject', 'Alpha__c')
      changes = addChange(changes, ChangeKind.Add, 'ApexClass', 'Zeta')
      changes = addChange(changes, ChangeKind.Add, 'ApexClass', 'Alpha')
      const sut = new ChangesManifestProcessor(getContext({ config, metadata }))

      // Act
      await sut.process(changes)

      // Assert
      const [, payload] = vi.mocked(outputFile).mock.calls[0]
      const parsed = JSON.parse(payload as string)
      expect(Object.keys(parsed.add)).toEqual(['ApexClass', 'CustomObject'])
      expect(parsed.add.ApexClass).toEqual(['Alpha', 'Zeta'])
      expect(parsed.add.CustomObject).toEqual(['Alpha__c', 'Beta__c'])
    })
  })

  describe('Given renames across multiple types registered in non-alphabetical order', () => {
    it('When process runs, Then the rename bucket keys are emitted in a stable, reproducible order so CI diffs stay noise-free', async () => {
      // Arrange — output key order is part of the JSON manifest's contract:
      // reviewers diff this file between CI runs, so insertion-order leakage
      // (Map iteration) would produce spurious diffs whenever handler visit
      // order shifts. Alphabetical ordering is the stable choice.
      config.changesManifest = 'changes.json'
      changes = addRename(changes, 'ZetaType', 'z.old', 'z.new')
      changes = addRename(changes, 'AlphaType', 'a.old', 'a.new')
      const sut = new ChangesManifestProcessor(getContext({ config, metadata }))

      // Act
      await sut.process(changes)

      // Assert
      const [, payload] = vi.mocked(outputFile).mock.calls[0]
      const parsed = JSON.parse(payload as string)
      expect(Object.keys(parsed.rename)).toEqual(['AlphaType', 'ZetaType'])
    })
  })
})
