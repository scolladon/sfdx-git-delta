'use strict'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import PermissionSetChildHandler from '../../../../src/service/permissionSetChildHandler'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import type { Work } from '../../../../src/types/work'
import { createElement } from '../../../__utils__/testElement'
import { getWork } from '../../../__utils__/testWork'

jest.mock('../../../../src/utils/fsHelper')

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let work: Work
beforeEach(() => {
  jest.clearAllMocks()
  work = getWork()
})

describe('PermissionSetChildHandler', () => {
  describe('Given Beta subdirectory format', () => {
    const betaLine =
      'A       force-app/main/default/permissionsets/Admin/fieldPermissions/Account.MyField__c.fieldPermission-meta.xml'

    it('When addition, Then manifest contains qualified member in Package', async () => {
      // Arrange
      const { changeType, element } = createElement(
        betaLine,
        globalMetadata.get(
          'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.MyField__c.fieldPermission-meta.xml'
        )!,
        globalMetadata
      )
      const sut = new PermissionSetChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'FieldPermission',
            member: 'Admin.Account.MyField__c',
          }),
        ])
      )
      expect(
        result.copies.some(
          (c: { kind: CopyOperationKind }) =>
            c.kind === CopyOperationKind.GitCopy
        )
      ).toBe(true)
      expect(result.copies).toHaveLength(1)
      expect(result.warnings).toHaveLength(0)
    })

    it('When deletion, Then manifest contains qualified member in DestructiveChanges', async () => {
      // Arrange
      const deletionLine =
        'D       force-app/main/default/permissionsets/Admin/fieldPermissions/Account.MyField__c.fieldPermission-meta.xml'
      const { changeType, element } = createElement(
        deletionLine,
        globalMetadata.get(
          'force-app/main/default/permissionsets/Admin/fieldPermissions/Account.MyField__c.fieldPermission-meta.xml'
        )!,
        globalMetadata
      )
      const sut = new PermissionSetChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: 'FieldPermission',
            member: 'Admin.Account.MyField__c',
          }),
        ])
      )
      expect(result.copies).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Given Beta2 flat format', () => {
    it('When addition, Then manifest contains qualified member in Package', async () => {
      // Arrange
      const flatLine =
        'A       force-app/main/default/permissionsets/Admin.Account.MyField__c.fieldPermission-meta.xml'
      const { changeType, element } = createElement(
        flatLine,
        globalMetadata.get(
          'force-app/main/default/permissionsets/Admin.Account.MyField__c.fieldPermission-meta.xml'
        )!,
        globalMetadata
      )
      const sut = new PermissionSetChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'FieldPermission',
            member: 'Admin.Account.MyField__c',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('Given metadata without parentXmlName', () => {
    it('When addition, Then falls back to componentName', async () => {
      // Arrange
      const noParentType = {
        directoryName: 'fieldPermissions',
        inFolder: false,
        metaFile: false,
        suffix: 'fieldPermission',
        xmlName: 'FieldPermission',
      }
      const line =
        'A       force-app/main/default/permissionsets/Admin/fieldPermissions/Account.MyField__c.fieldPermission-meta.xml'
      const { changeType, element } = createElement(
        line,
        noParentType,
        globalMetadata
      )
      const sut = new PermissionSetChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'FieldPermission',
            member: 'Account.MyField__c',
          }),
        ])
      )
    })
  })

  describe('Given parent directory not found in path', () => {
    it('When addition, Then falls back to componentName', async () => {
      // Arrange
      const typeDef = {
        directoryName: 'fieldPermissions',
        inFolder: false,
        metaFile: false,
        suffix: 'fieldPermission',
        xmlName: 'FieldPermission',
        parentXmlName: 'PermissionSet',
      }
      const line =
        'A       force-app/main/default/other/Admin/fieldPermissions/Account.MyField__c.fieldPermission-meta.xml'
      const { changeType, element } = createElement(
        line,
        typeDef,
        globalMetadata
      )
      const sut = new PermissionSetChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'FieldPermission',
            member: 'Account.MyField__c',
          }),
        ])
      )
    })
  })

  describe('Given Beta2 objectSettings format', () => {
    it('When addition, Then manifest contains qualified member in Package', async () => {
      // Arrange
      const objectSettingsLine =
        'A       force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml'
      const { changeType, element } = createElement(
        objectSettingsLine,
        globalMetadata.get(
          'force-app/main/default/permissionsets/Admin/objectSettings/Account.objectSettings-meta.xml'
        )!,
        globalMetadata
      )
      const sut = new PermissionSetChildHandler(changeType, element, work)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.manifests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.Package,
            type: 'ObjectSettings',
            member: 'Admin.Account',
          }),
        ])
      )
      expect(result.warnings).toHaveLength(0)
    })
  })
})
