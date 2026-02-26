'use strict'
import { describe, expect, it } from '@jest/globals'

import {
  extractPathFromDiffLine,
  normalizePathForMetadataLookup,
} from '../../../../src/utils/pathNormalizer'

describe('pathNormalizer', () => {
  describe('extractPathFromDiffLine', () => {
    it('extracts path from addition line', () => {
      expect(
        extractPathFromDiffLine('A\tforce-app/main/default/classes/Test.cls')
      ).toBe('force-app/main/default/classes/Test.cls')
    })

    it('extracts path from modification line', () => {
      expect(
        extractPathFromDiffLine(
          'M\tpkg-main/main/portals/experiences/MySite/config.json'
        )
      ).toBe('pkg-main/main/portals/experiences/MySite/config.json')
    })

    it('extracts path from deletion line', () => {
      expect(
        extractPathFromDiffLine(
          'D\tpkg-main/main/portals/experiences/Acme_Customer_Self_Service1.site-meta.xml'
        )
      ).toBe(
        'pkg-main/main/portals/experiences/Acme_Customer_Self_Service1.site-meta.xml'
      )
    })

    it('handles paths with multiple spaces after change type', () => {
      expect(
        extractPathFromDiffLine(
          'A       force-app/main/default/experiences/component/file.json'
        )
      ).toBe('force-app/main/default/experiences/component/file.json')
    })
  })

  describe('normalizePathForMetadataLookup', () => {
    it('normalizes path separators', () => {
      expect(
        normalizePathForMetadataLookup(
          'pkg-main\\main\\portals\\experiences\\MySite\\config.json'
        )
      ).toBe('pkg-main/main/portals/experiences/MySite/config.json')
    })
  })
})
