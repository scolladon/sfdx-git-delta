'use strict'
import { describe, expect, it } from 'vitest'

import type { ManifestElement } from '../../../../src/types/handlerResult'
import { ChangeKind, ManifestTarget } from '../../../../src/types/handlerResult'
import { applyBundleRollup } from '../../../../src/utils/bundleRollup'

const addPackage = (
  elements: ManifestElement[],
  type: string,
  member: string
) => {
  elements.push({
    target: ManifestTarget.Package,
    type,
    member,
    changeKind: ChangeKind.Add,
  })
}

const addDestructive = (
  elements: ManifestElement[],
  type: string,
  member: string
) => {
  elements.push({
    target: ManifestTarget.DestructiveChanges,
    type,
    member,
    changeKind: ChangeKind.Delete,
  })
}

describe('applyBundleRollup', () => {
  describe('Given a DigitalExperienceBundle and its DigitalExperience children in the package manifest', () => {
    it('When applied, Then the page-scoped children are dropped and unrelated types are untouched', () => {
      // Arrange
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
      addPackage(elements, 'DigitalExperience', 'site/foo.sfdc_cms__view/home')
      addPackage(elements, 'DigitalExperience', 'site/foo.sfdc_cms__route/Home')
      addPackage(elements, 'ApexClass', 'Untouched')

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual([elements[0], elements[3]])
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Given a DigitalExperienceBundle and its DigitalExperience children in the destructive manifest', () => {
    it('When applied, Then the page-scoped children are dropped and a deactivation warning is emitted', () => {
      // Arrange
      const elements: ManifestElement[] = []
      addDestructive(elements, 'DigitalExperienceBundle', 'site/foo')
      addDestructive(
        elements,
        'DigitalExperience',
        'site/foo.sfdc_cms__view/home'
      )

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual([elements[0]])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]?.message).toContain('site/foo')
    })
  })

  describe('Given a DigitalExperienceBundle in the package manifest but a DigitalExperience in the destructive manifest', () => {
    it('When applied, Then the destructive child is kept (roll-up is per manifest) and no warning is emitted', () => {
      // Arrange
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
      addDestructive(
        elements,
        'DigitalExperience',
        'site/foo.sfdc_cms__view/home'
      )

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual(elements)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Given a DigitalExperienceBundle whose name is a prefix of another site', () => {
    it('When applied, Then a DigitalExperience of the longer-named site is not swallowed', () => {
      // Arrange — `site/foo` must not cover `site/foobar.*`
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
      addPackage(
        elements,
        'DigitalExperience',
        'site/foobar.sfdc_cms__view/home'
      )

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual(elements)
    })
  })

  describe('Given DigitalExperience members with no DigitalExperienceBundle in the manifest', () => {
    it('When applied, Then the members are kept untouched', () => {
      // Arrange
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperience', 'site/foo.sfdc_cms__view/home')

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual(elements)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Given two DigitalExperienceBundle sites in the same manifest', () => {
    it('When applied, Then each bundle rolls up only its own children', () => {
      // Arrange
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
      addPackage(elements, 'DigitalExperienceBundle', 'site/bar')
      addPackage(elements, 'DigitalExperience', 'site/foo.sfdc_cms__view/home')
      addPackage(elements, 'DigitalExperience', 'site/bar.sfdc_cms__view/login')

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual([elements[0], elements[1]])
    })
  })

  describe('Given a non-DigitalExperience member whose name matches a bundle prefix', () => {
    it('When applied, Then only DigitalExperience members are rolled up — other types are left untouched', () => {
      // Arrange — the roll-up is scoped to the DigitalExperience type, even
      // when another type's member happens to share the bundle's prefix
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
      addPackage(elements, 'SomeOtherType', 'site/foo.sfdc_cms__view/home')

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual(elements)
    })
  })

  describe('Given a DigitalExperience member with no dot alongside a covering bundle member', () => {
    it('When applied, Then the dotless member is kept', () => {
      // Arrange — a canonical DE member is `<base>/<space>.<ct>/<cn>`; a
      // dotless member cannot be matched against any bundle prefix and must
      // survive the filter rather than throw.
      const elements: ManifestElement[] = []
      addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
      addPackage(elements, 'DigitalExperience', 'sitefoonodot')

      // Act
      const result = applyBundleRollup(elements)

      // Assert
      expect(result.keptElements).toEqual(elements)
    })
  })

  describe('T5c — rollup-filter totality', () => {
    it.each([
      { label: 'empty input', corpus: [] as ManifestElement[] },
      {
        label: 'a dotless DigitalExperience member alongside a bundle member',
        corpus: (() => {
          const elements: ManifestElement[] = []
          addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
          addPackage(elements, 'DigitalExperience', 'nodothere')
          return elements
        })(),
      },
      {
        label: 'a DigitalExperience member exactly equal to a bundle member',
        corpus: (() => {
          const elements: ManifestElement[] = []
          addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
          addPackage(elements, 'DigitalExperience', 'site/foo')
          return elements
        })(),
      },
      {
        label: 'the same (target, type, member) present twice',
        corpus: (() => {
          const elements: ManifestElement[] = []
          addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
          addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
          return elements
        })(),
      },
      {
        label:
          'a DigitalExperienceBundle under one target with DigitalExperience children under the other',
        corpus: (() => {
          const elements: ManifestElement[] = []
          addPackage(elements, 'DigitalExperienceBundle', 'site/foo')
          addDestructive(
            elements,
            'DigitalExperience',
            'site/foo.sfdc_cms__view/home'
          )
          return elements
        })(),
      },
    ])(
      'Given $label, When applied, Then it does not throw and returns both keptElements and warnings',
      ({ corpus }) => {
        // Act & Assert
        expect(() => applyBundleRollup(corpus)).not.toThrow()
        const result = applyBundleRollup(corpus)
        expect(Array.isArray(result.keptElements)).toBe(true)
        expect(Array.isArray(result.warnings)).toBe(true)
      }
    )
  })
})
