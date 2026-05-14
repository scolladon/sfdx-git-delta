'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InBundleHandler from '../../../../src/service/inBundleHandler'
import { ManifestTarget } from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { pathExists, readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = vi.mocked(readDirs)
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

let work: Work
beforeEach(() => {
  vi.clearAllMocks()
  work = getWork()
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
    return new InBundleHandler(changeType, element, work)
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
      mockedReadDirs.mockResolvedValue([])
      const sut = buildSut(line)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperienceBundle',
            member: 'site/component',
          }),
        ])
      )
      // bundle element copies the content file + its meta companion
      // (_shouldCopyMetaFile stays true on the coarse path)
      expect(result.copies).toHaveLength(2)
      expect(result.warnings).toHaveLength(0)
    })

    it('Given sub workspace file addition, When collect, Then returns manifest with parent bundle name', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([])
      const sut = buildSut(
        'A       force-app/main/default/digitalExperiences/site/component/workspace/file.json'
      )

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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

    it('Given a page content file addition, When collect, Then adds a page-scoped member and copies only its content folder', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([
        `${pageFolder}/content.json`,
        `${pageFolder}/_meta.json`,
        `${pageFolder}/fr.json`,
        `${root}/site/Site_A/sfdc_cms__view/page_b/content.json`,
      ])
      const sut = buildSut(`A       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'DigitalExperience',
            member: 'site/Site_A.sfdc_cms__view/page_a',
          }),
        ])
      )
      // only the changed page's content folder — sibling page_b is excluded
      expect(new Set(result.copies.map(copy => copy.path))).toEqual(
        new Set([
          `${pageFolder}/content.json`,
          `${pageFolder}/_meta.json`,
          `${pageFolder}/fr.json`,
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })

    it('Given a page content file modification, When collect, Then adds a page-scoped DigitalExperience member to the package manifest', async () => {
      // Arrange
      mockedReadDirs.mockResolvedValue([`${pageFolder}/content.json`])
      const sut = buildSut(`M       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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
      mockedReadDirs.mockResolvedValue([])
      mockedPathExists.mockResolvedValue(false)
      const sut = buildSut(`D       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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
      mockedReadDirs.mockResolvedValue([`${pageFolder}/_meta.json`])
      mockedPathExists.mockResolvedValue(true)
      const sut = buildSut(`D       ${pageContentPath}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.changes.toElements()).toEqual(
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
