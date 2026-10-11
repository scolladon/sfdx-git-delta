'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InBundleHandler from '../../../../src/service/inBundleHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { RunContext } from '../../../../src/types/runContext'
import { pathExists } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
const mockedPathExists = vi.mocked(pathExists)

const objectType = {
  directoryName: 'digitalExperiences',
  inFolder: false,
  metaFile: true,
  suffix: 'digitalExperience',
  xmlName: 'DigitalExperienceBundle',
}
const entityPath =
  'force-app/main/default/digitalExperiences/site/component.digitalExperience-meta.xml'
const line = `A       ${entityPath}`

const root = 'force-app/main/default/digitalExperiences'
const bundleMetaPath = `${root}/site/Site_A/Site_A.digitalExperience-meta.xml`
const contentTypeFilePath = `${root}/site/Site_A/sfdc_cms__view/file.json`
const pageFolder = `${root}/site/Site_A/sfdc_cms__view/page_a`
const pageContentPath = `${pageFolder}/content.json`
const pageVariantPath = `${pageFolder}/mobile/mobile.json`
const pageRequest = () => ({
  kind: CopyOperationKind.GitComponentCopy,
  path: pageFolder,
  revision: config.to,
})
const requestsOf = (copies: readonly { kind: string }[]) =>
  copies.filter(copy => copy.kind === CopyOperationKind.GitComponentCopy)

let config: Config
// One context per test, built once and reused for both construction and
// assertion. Asserting against this reference proves the sut forwarded the
// context it was given; rebuilding it in the assertion would not, since a
// fresh metadata mock is never deep-equal to the original.
let ctx: RunContext
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
  ctx = getContext({ config })
})

describe('InBundleHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  const buildSut = (changeLine: string) => {
    const { changeType, element } = createElement(
      changeLine,
      objectType,
      globalMetadata
    )
    return new InBundleHandler(changeType, element, ctx)
  }

  describe('_getElementName', () => {
    describe('when called with meta file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const sut = buildSut(line)

        // Act
        const result = sut['_getElementName']()

        // Assert
        expect(result).toEqual('site/component')
      })
    })

    describe('when called with sub workspace file', () => {
      it('returns <site workspace>/<workspace name>', () => {
        // Arrange
        const sut = buildSut(
          'A       force-app/main/default/digitalExperiences/site/component/workspace/file.json'
        )

        // Act
        const result = sut['_getElementName']()

        // Assert
        expect(result).toEqual('site/component')
      })
    })
  })

  describe('getElementDescriptor', () => {
    describe('when the change targets a page content file', () => {
      it('When called, Then returns a page-scoped DigitalExperience member', () => {
        // Arrange
        const sut = buildSut(`A       ${pageContentPath}`)

        // Act
        const result = sut.getElementDescriptor()

        // Assert
        expect(result).toEqual({
          type: 'DigitalExperience',
          member: 'site/Site_A.sfdc_cms__view/page_a',
        })
      })
    })

    describe('when the change targets a page variant file', () => {
      it('When called, Then returns the page-scoped member of its content folder', () => {
        // Arrange
        const sut = buildSut(`A       ${pageVariantPath}`)

        // Act
        const result = sut.getElementDescriptor()

        // Assert
        expect(result).toEqual({
          type: 'DigitalExperience',
          member: 'site/Site_A.sfdc_cms__view/page_a',
        })
      })
    })

    describe('when the change targets the bundle meta file', () => {
      it('When called, Then returns a coarse DigitalExperienceBundle member', () => {
        // Arrange
        const sut = buildSut(`A       ${bundleMetaPath}`)

        // Act
        const result = sut.getElementDescriptor()

        // Assert
        expect(result).toEqual({
          type: 'DigitalExperienceBundle',
          member: 'site/Site_A',
        })
      })
    })

    describe('when the change targets a file directly under the content type folder', () => {
      it('When called, Then falls back to a coarse DigitalExperienceBundle member', () => {
        // Arrange
        const sut = buildSut(`A       ${contentTypeFilePath}`)

        // Act
        const result = sut.getElementDescriptor()

        // Assert
        expect(result).toEqual({
          type: 'DigitalExperienceBundle',
          member: 'site/Site_A',
        })
      })
    })
  })

  describe('collect', () => {
    it('Given meta file addition, When collect, Then returns manifest with correct bundle element name', async () => {
      // Arrange
      const sut = buildSut(line)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperienceBundle',
            member: 'site/component',
          }),
        ])
      )
      // bundle element copies the content file + its meta companion
      // (_shouldCopyMetaFile stays true on the coarse path) and requests
      // its component
      expect(result.copies).toHaveLength(3)
      expect(result.copies).toContainEqual({
        kind: CopyOperationKind.GitComponentCopy,
        path: createElement(line, objectType, globalMetadata).element
          .componentPath,
        revision: config.to,
      })
      expect(result.warnings).toHaveLength(0)
    })

    it('Given sub workspace file addition, When collect, Then returns manifest with parent bundle name', async () => {
      // Arrange
      const sut = buildSut(
        'A       force-app/main/default/digitalExperiences/site/component/workspace/file.json'
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperienceBundle',
            member: 'site/component',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page content file addition, When collect, Then adds a page-scoped member and copies the full content folder recursively', async () => {
      // Arrange
      const sut = buildSut(`A       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperience',
            member: 'site/Site_A.sfdc_cms__view/page_a',
          }),
        ])
      )
      expect(requestsOf(result.copies)).toEqual([pageRequest()])
      expect(result.copies).toHaveLength(2)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page content change with a sibling page present, When collect, Then no sibling path is copied', async () => {
      // Arrange
      const sut = buildSut(`A       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      // the request targets the page folder, not the whole bundle
      expect(result.copies.some(copy => copy.path.includes('/page_b'))).toBe(
        false
      )
      expect(requestsOf(result.copies)).toEqual([pageRequest()])
      expect(result.copies).toHaveLength(2)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page variant file change, When collect, Then the full page_a tree still ships and the member stays page-scoped', async () => {
      // Arrange
      const sut = buildSut(`M       ${pageVariantPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperience',
            member: 'site/Site_A.sfdc_cms__view/page_a',
          }),
        ])
      )
      expect(requestsOf(result.copies)).toEqual([pageRequest()])
      expect(result.copies).toHaveLength(2)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page content file modification, When collect, Then adds a page-scoped DigitalExperience member to the package manifest', async () => {
      // Arrange
      const sut = buildSut(`M       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperience',
            member: 'site/Site_A.sfdc_cms__view/page_a',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page content file deletion where the page folder is gone, When collect, Then adds a page-scoped DigitalExperience member to the destructiveChanges manifest', async () => {
      // Arrange
      mockedPathExists.mockResolvedValue(false)
      const sut = buildSut(`D       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'DigitalExperience',
            member: 'site/Site_A.sfdc_cms__view/page_a',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page content file deletion where the page folder still exists, When collect, Then treats it as a modification on the package manifest', async () => {
      // Arrange
      mockedPathExists.mockResolvedValue(true)
      const sut = buildSut(`D       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperience',
            member: 'site/Site_A.sfdc_cms__view/page_a',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })
  })
})
