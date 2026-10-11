'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import InResourceHandler from '../../../../src/service/inResourceHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { RunContext } from '../../../../src/types/runContext'
import { pathExists, readDirs } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const mockedPathExists = vi.mocked(pathExists)

const lwcType = {
  directoryName: 'lwc',
  inFolder: false,
  metaFile: false,
  suffix: '',
  xmlName: 'LightningComponentBundle',
}

const staticResourceType = {
  directoryName: 'staticresources',
  inFolder: false,
  metaFile: true,
  suffix: 'resource',
  xmlName: 'StaticResource',
}
const experienceBundleType = {
  directoryName: 'experiences',
  inFolder: false,
  metaFile: true,
  suffix: 'site',
  xmlName: 'ExperienceBundle',
}
const elementName = 'myResources'
const basePath = 'force-app/main/default/staticresources'
const entityPath = `${basePath}/${elementName}.js`
const xmlName = 'StaticResource'
const line = `A       ${entityPath}`
const type = 'resource'
let config: Config
// One context per test, built once and reused for both construction and
// assertion. Asserting against this reference proves the sut forwarded the
// context it was given; rebuilding it in the assertion would not, since a
// fresh metadata mock is never deep-equal to the original.
let ctx: RunContext
const componentRequest = (path: string) => ({
  kind: CopyOperationKind.GitComponentCopy,
  path,
  revision: config.to,
})
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
  ctx = getContext({ config })
})

describe('InResourceHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  describe('When entity is added', () => {
    describe('when not generating delta', () => {
      beforeEach(() => {
        config.generateDelta = false
      })
      it('should add manifest entry', async () => {
        // Arrange
        const { changeType, element } = createElement(
          line,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: xmlName,
              member: elementName,
            }),
          ])
        )
      })

      it('Given file extension matches metadata suffix, When entity is added, Then uses last path segment for element name', async () => {
        // Arrange
        const resourceLine = `A       ${basePath}/${elementName}.${type}`
        const { changeType, element } = createElement(
          resourceLine,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: xmlName,
              member: elementName,
            }),
          ])
        )
      })

      it('Given generateDelta false with matching resources, When collect, Then no resource copies are produced', async () => {
        // Arrange
        const { changeType, element } = createElement(
          line,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result).length).toBeGreaterThan(0)
        expect(result.copies).toHaveLength(0)
      })

      it('should correctly identify component name in deeply nested metadata kind folder structure', async () => {
        // Arrange
        const lwcType = {
          directoryName: 'lwc',
          inFolder: false,
          metaFile: false,
          xmlName: 'LightningComponentBundle',
          element: 'deeplyNestedComponent',
        }
        const nestedPath = `force-app/main/default/lwc/sub_folder1/lwc/${lwcType.element}/${lwcType.element}.js`
        const line = `A       ${nestedPath}`
        const { changeType, element } = createElement(
          line,
          lwcType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: lwcType.xmlName,
              member: lwcType.element,
            }),
          ])
        )
      })
    })

    describe('when generating delta', () => {
      beforeEach(() => {
        config.generateDelta = true
      })
      describe('when matching resource exist', () => {
        it('should copy the changed lwc file and request its bundle folder', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'myComponent'
          const path = `${entity}/${entity}.js`
          const line = `A       ${base}${lwcType.directoryName}/${path}`
          const { changeType, element } = createElement(
            line,
            lwcType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: lwcType.xmlName,
                member: entity,
              }),
            ])
          )
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: 'force-app/main/default/lwc/myComponent/myComponent.js',
              }),
              componentRequest('force-app/main/default/lwc/myComponent'),
            ])
          )
          expect(
            result.copies.filter(
              op => op.kind === CopyOperationKind.GitComponentCopy
            )
          ).toHaveLength(1)
        })

        it('should copy static resource file and its meta at same level', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'imageFile'
          const path = `${entity}.png`
          const line = `A       ${base}${staticResourceType.directoryName}/${path}`
          const { changeType, element } = createElement(
            line,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: staticResourceType.xmlName,
                member: entity,
              }),
            ])
          )
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${base}${staticResourceType.directoryName}/${path}`,
              }),
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${base}${staticResourceType.directoryName}/${entity}.${staticResourceType.suffix}${METAFILE_SUFFIX}`,
              }),
              componentRequest(
                'force-app/main/default/staticresources/imageFile'
              ),
            ])
          )
        })

        it('Given single-file static resource added, When collecting, Then should only copy that resource and its meta', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'singleFile'
          const path = `${entity}.xlsx`
          const singleFileLine = `A       ${base}${staticResourceType.directoryName}/${path}`
          const { changeType, element } = createElement(
            singleFileLine,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                path: `${base}${staticResourceType.directoryName}/${path}`,
              }),
              expect.objectContaining({
                path: `${base}${staticResourceType.directoryName}/${entity}.${staticResourceType.suffix}${METAFILE_SUFFIX}`,
              }),
              componentRequest(
                'force-app/main/default/staticresources/singleFile'
              ),
            ])
          )
          expect(result.copies).not.toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                path: expect.stringContaining('otherResource'),
              }),
            ])
          )
        })

        it('Given single-file static resource added, When collecting, Then it requests the component path without listing', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'myFile'
          const path = `${entity}.png`
          const singleFileLine = `A       ${base}${staticResourceType.directoryName}/${path}`
          const { changeType, element } = createElement(
            singleFileLine,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(result.copies).toContainEqual(
            componentRequest('force-app/main/default/staticresources/myFile')
          )
          expect(readDirs).not.toHaveBeenCalled()
        })

        it('should copy static resource folder content and its meta', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'imageFolder'
          const path = `${entity}/logo.png`
          const line = `A       ${base}${staticResourceType.directoryName}/${path}`
          const { changeType, element } = createElement(
            line,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: staticResourceType.xmlName,
                member: entity,
              }),
            ])
          )
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${base}${staticResourceType.directoryName}/${path}`,
              }),
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${base}${staticResourceType.directoryName}/${entity}.${staticResourceType.suffix}${METAFILE_SUFFIX}`,
              }),
              componentRequest(
                'force-app/main/default/staticresources/imageFolder'
              ),
            ])
          )
        })

        it('should copy experience bundle with site meta and contained files', async () => {
          // Arrange
          const base = 'force-app/main/default/'
          const entity = 'my_experience_bundle'
          const path = `${entity}/config/myexperiencebundle.json`
          const line = `A       ${base}${experienceBundleType.directoryName}/${path}`
          const { changeType, element } = createElement(
            line,
            experienceBundleType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: experienceBundleType.xmlName,
                member: entity,
              }),
            ])
          )
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${base}${experienceBundleType.directoryName}/${path}`,
              }),
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${base}${experienceBundleType.directoryName}/${entity}.${experienceBundleType.suffix}${METAFILE_SUFFIX}`,
              }),
              componentRequest(
                'force-app/main/default/experiences/my_experience_bundle'
              ),
            ])
          )
        })
      })

      describe('when no matching resource exist', () => {
        it('should try copy resource files', async () => {
          // Arrange
          const { changeType, element } = createElement(
            line,
            staticResourceType,
            globalMetadata
          )
          const sut = new InResourceHandler(changeType, element, ctx)

          // Act
          const result = await sut.collect()

          // Assert
          expect(elementsOf(result)).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                target: ManifestTarget.Package,
                type: xmlName,
                member: elementName,
              }),
            ])
          )
          expect(result.copies).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: entityPath,
              }),
              expect.objectContaining({
                kind: CopyOperationKind.GitCopy,
                path: `${basePath}/${elementName}.${type}${METAFILE_SUFFIX}`,
              }),
              componentRequest(`${basePath}/${elementName}`),
            ])
          )
        })
      })
    })
  })

  describe('When entity is deleted', () => {
    beforeEach(() => {
      config.generateDelta = false
    })
    describe('When only a resource sub element is deleted', () => {
      beforeEach(() => {
        mockedPathExists.mockResolvedValue(true)
      })
      it('should treat it as a modification', async () => {
        // Arrange
        const { changeType, element } = createElement(
          `D       ${entityPath}`,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: xmlName,
              member: elementName,
            }),
          ])
        )
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining('resource'),
          ctx
        )
      })
    })
    describe('When the resource is deleted', () => {
      beforeEach(() => {
        mockedPathExists.mockResolvedValue(false)
      })
      it('should treat it as a deletion', async () => {
        // Arrange
        const { changeType, element } = createElement(
          `D       ${entityPath}`,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.DestructiveChanges,
              type: xmlName,
              member: elementName,
            }),
          ])
        )
        expect(result.copies).toEqual([])
        expect(pathExists).toHaveBeenCalledWith(
          expect.stringContaining('staticresources'),
          ctx
        )
      })
    })
    describe('Given a deleted file whose component still exists at to and generate-delta on', () => {
      it('When collect, Then it requests the component like a modification', async () => {
        // Arrange
        config.generateDelta = true
        mockedPathExists.mockResolvedValue(true)
        const { changeType, element } = createElement(
          `D       ${entityPath}`,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(result.copies).toContainEqual(
          componentRequest(`${basePath}/${elementName}`)
        )
      })
    })

    describe('When single-file resource is deleted', () => {
      it('Given single-file static resource deleted, When collecting, Then pathExists checks the component path and deletion flows through', async () => {
        // Arrange
        const base = 'force-app/main/default/'
        const entity = 'myFile'
        const path = `${entity}.png`
        const deleteLine = `D       ${base}${staticResourceType.directoryName}/${path}`
        mockedPathExists.mockResolvedValue(false)
        const { changeType, element } = createElement(
          deleteLine,
          staticResourceType,
          globalMetadata
        )
        const sut = new InResourceHandler(changeType, element, ctx)

        // Act
        const result = await sut.collect()

        // Assert
        expect(pathExists).toHaveBeenCalledWith(
          `${base}${staticResourceType.directoryName}/${entity}`,
          ctx
        )
        expect(
          elementsOf(result).some(m => m.target === 'destructiveChanges')
        ).toBe(true)
      })
    })
  })
})
