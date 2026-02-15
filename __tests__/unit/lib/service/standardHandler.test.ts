'use strict'
import { describe, expect, it, jest } from '@jest/globals'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { METAFILE_SUFFIX } from '../../../../src/constant/metadataConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import StandardHandler from '../../../../src/service/standardHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

const testSuitesType = {
  directoryName: 'testSuites',
  inFolder: false,
  metaFile: false,
  suffix: 'testSuite',
  xmlName: 'ApexTestSuite',
}
const classType = {
  directoryName: 'classes',
  inFolder: false,
  metaFile: true,
  suffix: 'cls',
  xmlName: 'ApexClass',
}
const entity = 'MyClass'
const basePath = 'force-app/main/default/'
const entityPath = `${basePath}${classType.directoryName}/${entity}.${classType.suffix}`

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe(`StandardHandler`, () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('collect', () => {
    it('Given addition, When collect is called, Then returns manifest element and copy operations', async () => {
      // Arrange
      work.config.to = 'sha123'
      const line = `${ADDITION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0]).toEqual({
        target: ManifestTarget.Package,
        type: classType.xmlName,
        member: entity,
      })
      expect(result.copies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: CopyOperationKind.GitCopy,
            path: entityPath,
            revision: 'sha123',
          }),
        ])
      )
      expect(result.warnings).toEqual([])
    })

    it('Given addition with metaFile type, When collect is called, Then includes meta file copy', async () => {
      // Arrange
      work.config.to = 'sha123'
      const line = `${ADDITION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      const metaCopy = result.copies.find(c => c.path.endsWith(METAFILE_SUFFIX))
      expect(metaCopy).toBeDefined()
      expect(metaCopy!.kind).toBe(CopyOperationKind.GitCopy)
    })

    it('Given deletion, When collect is called, Then returns destructive manifest element only', async () => {
      // Arrange
      const line = `${DELETION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0]).toEqual({
        target: ManifestTarget.DestructiveChanges,
        type: classType.xmlName,
        member: entity,
      })
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('Given modification, When collect is called, Then returns same result as addition', async () => {
      // Arrange
      work.config.to = 'sha123'
      const line = `${MODIFICATION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0].target).toBe(ManifestTarget.Package)
      expect(result.copies.length).toBeGreaterThan(0)
    })

    it('Given unprocessable line, When collect is called, Then returns empty result', async () => {
      // Arrange
      const line = `${ADDITION}       force-app/main/default/classes/folder/Random.file`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('Given unknown change type, When collect is called, Then returns empty result', async () => {
      // Arrange
      const line = `Z       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toEqual([])
    })

    it('Given error during collect, When collect is called, Then returns error in warnings', async () => {
      // Arrange
      work.config.to = 'sha123'
      const line = `${ADDITION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)
      jest
        .spyOn(sut, 'collectAddition')
        .mockRejectedValueOnce(new Error('test error'))

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].message).toContain('test error')
    })

    it('Given addition with generateDelta false, When collect, Then returns manifest without copies', async () => {
      // Arrange
      work.config.generateDelta = false
      const line = `${ADDITION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toHaveLength(1)
      expect(result.manifests[0].target).toBe(ManifestTarget.Package)
      expect(result.copies).toHaveLength(0)
    })

    it('Given type without metaFile, When collectAddition is called, Then does not include meta copy', async () => {
      // Arrange
      work.config.to = 'sha123'
      const entityPath = `${basePath}testSuites/suite.testSuite`
      const line = `${ADDITION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        testSuitesType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies).toHaveLength(1)
      expect(result.copies[0].path).toBe(entityPath)
    })
  })

  describe('toString', () => {
    it('should return a string representation of the handler', () => {
      // Arrange
      const line = `${ADDITION}       ${entityPath}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(changeType, element, work)

      // Act
      const result = sut.toString()

      // Assert
      expect(result).toBe(
        `${sut.constructor.name}: ${sut['changeType']} -> ${sut['element'].basePath}`
      )
    })
  })
})
