'use strict'
import { describe, expect, it, vi } from 'vitest'

import {
  parseFromSideSwallowing,
  parseToSidePropagating,
} from '../../../../../src/utils/metadataDiff/xmlEventReader'

vi.mock('../../../../../src/utils/LoggingService')

const PROFILE_WITH_ATTRS_AND_COMMENT = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <!-- a comment -->
  <fieldPermissions>
    <field>Account.Name</field>
    <editable>true</editable>
    <readable>true</readable>
  </fieldPermissions>
  <fieldPermissions>
    <field>Account.Description</field>
    <editable>false</editable>
    <readable>true</readable>
  </fieldPermissions>
  <fieldPermissions>
    <field>Contact.Email</field>
    <editable>true</editable>
    <readable>true</readable>
  </fieldPermissions>
</Profile>`

describe('xmlEventReader', () => {
  describe('parseToSidePropagating', () => {
    it('Given a Profile with three fieldPermissions and a root-level comment, When parseToSidePropagating runs, Then onElement is invoked per child and root capture contains the xmlns', async () => {
      // Arrange
      const calls: Array<[string, unknown]> = []
      const onElement = vi.fn((subType: string, element: unknown) => {
        calls.push([subType, element])
      })

      // Act
      const sut = await parseToSidePropagating(
        PROFILE_WITH_ATTRS_AND_COMMENT,
        onElement
      )

      // Assert
      expect(sut.rootKey).toBe('Profile')
      expect(sut.rootAttributes).toEqual({
        '@_xmlns': 'http://soap.sforce.com/2006/04/metadata',
      })
      const fieldPermissionsCalls = calls.filter(
        ([subType]) => subType === 'fieldPermissions'
      )
      expect(fieldPermissionsCalls).toHaveLength(3)
    })

    it('Given malformed XML, When parseToSidePropagating runs, Then the rejection propagates', async () => {
      // Arrange
      const source = '<Root><unclosed>'
      const onElement = vi.fn()

      // Act & Assert
      await expect(parseToSidePropagating(source, onElement)).rejects.toThrow()
    })

    it('Given empty XML, When parseToSidePropagating runs, Then the rejection propagates', async () => {
      // Arrange
      const source = ''
      const onElement = vi.fn()

      // Act & Assert
      await expect(parseToSidePropagating(source, onElement)).rejects.toThrow()
    })
  })

  describe('parseFromSideSwallowing', () => {
    it('Given a valid source, When parseFromSideSwallowing runs, Then elements are emitted and RootCapture returned', async () => {
      // Arrange
      const calls: Array<[string, unknown]> = []
      const onElement = vi.fn((subType: string, element: unknown) => {
        calls.push([subType, element])
      })

      // Act
      const sut = await parseFromSideSwallowing(
        PROFILE_WITH_ATTRS_AND_COMMENT,
        onElement
      )

      // Assert
      expect(sut).not.toBeNull()
      expect(sut?.rootKey).toBe('Profile')
      expect(
        calls.filter(([subType]) => subType === 'fieldPermissions')
      ).toHaveLength(3)
    })

    it('Given a null source, When parseFromSideSwallowing runs, Then it resolves null', async () => {
      // Arrange
      const onElement = vi.fn()

      // Act
      const sut = await parseFromSideSwallowing(null, onElement)

      // Assert
      expect(sut).toBeNull()
      expect(onElement).not.toHaveBeenCalled()
    })

    it('Given an undefined source, When parseFromSideSwallowing runs, Then it resolves null', async () => {
      // Arrange
      const onElement = vi.fn()

      // Act
      const sut = await parseFromSideSwallowing(undefined, onElement)

      // Assert
      expect(sut).toBeNull()
    })

    it('Given an empty string source, When parseFromSideSwallowing runs, Then it resolves null without emission', async () => {
      // Arrange
      const onElement = vi.fn()

      // Act
      const sut = await parseFromSideSwallowing('', onElement)

      // Assert
      expect(sut).toBeNull()
      expect(onElement).not.toHaveBeenCalled()
    })

    it('Given malformed XML, When parseFromSideSwallowing runs, Then it resolves null and swallows the error', async () => {
      // Arrange
      const source = '<Root><unclosed>'
      const onElement = vi.fn()

      // Act
      const sut = await parseFromSideSwallowing(source, onElement)

      // Assert
      expect(sut).toBeNull()
    })

    it('Given a Buffer source, When parseFromSideSwallowing runs, Then it decodes and emits elements', async () => {
      // Arrange
      const onElement = vi.fn()

      // Act
      const sut = await parseFromSideSwallowing(
        Buffer.from(PROFILE_WITH_ATTRS_AND_COMMENT, 'utf8'),
        onElement
      )

      // Assert
      expect(sut).not.toBeNull()
      expect(onElement).toHaveBeenCalled()
    })

    it('Given a document with only a comment at root, When parseFromSideSwallowing runs, Then no subType elements are emitted', async () => {
      // Arrange
      const onElement = vi.fn()
      const source = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <!-- only a comment -->
</Profile>`

      // Act
      const sut = await parseFromSideSwallowing(source, onElement)

      // Assert
      expect(sut?.rootKey).toBe('Profile')
      // #comment is an attribute-like key not a subType, so it is not emitted
      const nonCommentCalls = onElement.mock.calls.filter(
        ([subType]) => !(subType as string).startsWith('@_')
      )
      const subTypeCalls = nonCommentCalls.filter(
        ([subType]) => subType !== '#comment'
      )
      expect(subTypeCalls).toHaveLength(0)
    })
  })
})
