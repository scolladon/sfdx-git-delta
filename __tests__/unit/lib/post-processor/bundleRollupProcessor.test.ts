'use strict'
import { beforeEach, describe, expect, it } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import BundleRollupProcessor from '../../../../src/post-processor/bundleRollupProcessor'
import { ChangeKind, ManifestTarget } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { getWork } from '../../../__utils__/testWork'

describe('BundleRollupProcessor', () => {
  let work: Work
  // The processor never reads the metadata registry — a stub keeps the suite
  // fast without loading the real registry.
  const metadata = {} as MetadataRepository
  beforeEach(() => {
    work = getWork()
  })

  const addPackage = (type: string, member: string) =>
    work.changes.addElement({
      target: ManifestTarget.Package,
      type,
      member,
      changeKind: ChangeKind.Add,
    })
  const addDestructive = (type: string, member: string) =>
    work.changes.addElement({
      target: ManifestTarget.DestructiveChanges,
      type,
      member,
      changeKind: ChangeKind.Delete,
    })

  describe('Given a DigitalExperienceBundle and its DigitalExperience children in the package manifest', () => {
    it('When process runs, Then the page-scoped children are dropped and unrelated types are untouched', async () => {
      // Arrange
      addPackage('DigitalExperienceBundle', 'site/foo')
      addPackage('DigitalExperience', 'site/foo.sfdc_cms__view/home')
      addPackage('DigitalExperience', 'site/foo.sfdc_cms__route/Home')
      addPackage('ApexClass', 'Untouched')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      const pkg = work.changes.forPackageManifest()
      expect(pkg.get('DigitalExperienceBundle')).toEqual(new Set(['site/foo']))
      expect(pkg.has('DigitalExperience')).toBe(false)
      expect(pkg.get('ApexClass')).toEqual(new Set(['Untouched']))
      expect(work.warnings).toHaveLength(0)
    })
  })

  describe('Given a DigitalExperienceBundle and its DigitalExperience children in the destructive manifest', () => {
    it('When process runs, Then the page-scoped children are dropped and a deactivation warning is emitted', async () => {
      // Arrange
      addDestructive('DigitalExperienceBundle', 'site/foo')
      addDestructive('DigitalExperience', 'site/foo.sfdc_cms__view/home')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      const destructive = work.changes.forDestructiveManifest()
      expect(destructive.get('DigitalExperienceBundle')).toEqual(
        new Set(['site/foo'])
      )
      expect(destructive.has('DigitalExperience')).toBe(false)
      expect(work.warnings).toHaveLength(1)
      expect(work.warnings[0].message).toContain('site/foo')
    })
  })

  describe('Given a DigitalExperienceBundle in the package manifest but a DigitalExperience in the destructive manifest', () => {
    it('When process runs, Then the destructive child is kept (roll-up is per manifest) and no warning is emitted', async () => {
      // Arrange
      addPackage('DigitalExperienceBundle', 'site/foo')
      addDestructive('DigitalExperience', 'site/foo.sfdc_cms__view/home')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(
        work.changes.forDestructiveManifest().get('DigitalExperience')
      ).toEqual(new Set(['site/foo.sfdc_cms__view/home']))
      expect(work.warnings).toHaveLength(0)
    })
  })

  describe('Given a DigitalExperienceBundle whose name is a prefix of another site', () => {
    it('When process runs, Then a DigitalExperience of the longer-named site is not swallowed', async () => {
      // Arrange — `site/foo` must not cover `site/foobar.*`
      addPackage('DigitalExperienceBundle', 'site/foo')
      addPackage('DigitalExperience', 'site/foobar.sfdc_cms__view/home')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(
        work.changes.forPackageManifest().get('DigitalExperience')
      ).toEqual(new Set(['site/foobar.sfdc_cms__view/home']))
    })
  })

  describe('Given DigitalExperience members with no DigitalExperienceBundle in the manifest', () => {
    it('When process runs, Then the members are kept untouched', async () => {
      // Arrange
      addPackage('DigitalExperience', 'site/foo.sfdc_cms__view/home')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(
        work.changes.forPackageManifest().get('DigitalExperience')
      ).toEqual(new Set(['site/foo.sfdc_cms__view/home']))
      expect(work.warnings).toHaveLength(0)
    })
  })

  describe('Given two DigitalExperienceBundle sites in the same manifest', () => {
    it('When process runs, Then each bundle rolls up only its own children', async () => {
      // Arrange
      addPackage('DigitalExperienceBundle', 'site/foo')
      addPackage('DigitalExperienceBundle', 'site/bar')
      addPackage('DigitalExperience', 'site/foo.sfdc_cms__view/home')
      addPackage('DigitalExperience', 'site/bar.sfdc_cms__view/login')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      const pkg = work.changes.forPackageManifest()
      expect(pkg.get('DigitalExperienceBundle')).toEqual(
        new Set(['site/foo', 'site/bar'])
      )
      expect(pkg.has('DigitalExperience')).toBe(false)
    })
  })

  describe('Given a non-DigitalExperience member whose name matches a bundle prefix', () => {
    it('When process runs, Then only DigitalExperience members are rolled up — other types are left untouched', async () => {
      // Arrange — the roll-up is scoped to the DigitalExperience type, even
      // when another type's member happens to share the bundle's prefix
      addPackage('DigitalExperienceBundle', 'site/foo')
      addPackage('SomeOtherType', 'site/foo.sfdc_cms__view/home')
      const sut = new BundleRollupProcessor(work, metadata)

      // Act
      await sut.process()

      // Assert
      expect(work.changes.forPackageManifest().get('SomeOtherType')).toEqual(
        new Set(['site/foo.sfdc_cms__view/home'])
      )
    })
  })
})
