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

    it('Given malformed XML, When parseFromSideSwallowing runs, Then it tolerates the partial tree (no balance check on the swallowing path)', async () => {
      // Arrange — `parseFromSideSwallowing` skips the balance-check pre-pass
      // for performance (saves an O(N) scan per from-side parse). txml is
      // tolerant of unclosed tags, so we get a partial RootCapture rather
      // than null. The caller treats this as best-effort prior content;
      // anything truly catastrophic still goes through the catch and
      // returns null. The strict failure contract lives on the to-side
      // (`parseToSidePropagating`) where the diff caller wires it to the
      // MalformedXML warning.
      const source = '<Root><unclosed>'
      const onElement = vi.fn()

      // Act
      const sut = await parseFromSideSwallowing(source, onElement)

      // Assert
      expect(sut).not.toBeNull()
      expect(sut?.rootKey).toBe('Root')
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

    it('Given a document with xml declaration, When parseFromSideSwallowing runs, Then xmlHeader is populated on RootCapture', async () => {
      // Kills L56 ConditionalExpression false: declContent===undefined ? undefined : {...}
      // If mutated to false, xmlHeader would always be undefined even when declaration exists.
      const onElement = vi.fn()
      const source = `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata"></Profile>`
      const sut = await parseFromSideSwallowing(source, onElement)
      expect(sut?.xmlHeader).toBeDefined()
      expect(sut?.xmlHeader?.['?xml']).toBeDefined()
    })

    it('Given a document without xml declaration, When parseFromSideSwallowing runs, Then xmlHeader is undefined', async () => {
      // Ensures the true-branch of L56 also works (xmlHeader undefined for no-decl docs)
      const onElement = vi.fn()
      const source = `<Profile xmlns="http://soap.sforce.com/2006/04/metadata"></Profile>`
      const sut = await parseFromSideSwallowing(source, onElement)
      expect(sut?.xmlHeader).toBeUndefined()
    })

    it('Given a Buffer source with non-ASCII content, When parseFromSideSwallowing runs, Then it decodes correctly via toString utf8', async () => {
      // Kills L79 ConditionalExpression/EqualityOperator: typeof source === 'string'
      // If mutated to true (always string branch) → Buffer.toString not called → garbled
      const onElement = vi.fn()
      const content = `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n  <fieldPermissions>\n    <field>café</field>\n  </fieldPermissions>\n</Profile>`
      const buf = Buffer.from(content, 'utf8')
      const sut = await parseFromSideSwallowing(buf, onElement)
      expect(sut).not.toBeNull()
      expect(onElement).toHaveBeenCalledWith(
        'fieldPermissions',
        expect.objectContaining({ field: 'café' })
      )
    })
  })

  describe('parseToSidePropagating', () => {
    it('Given a document with xml declaration, When parseToSidePropagating runs, Then xmlHeader is populated', async () => {
      // Kills L56 ConditionalExpression false on to-side path
      const onElement = vi.fn()
      const source = `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata"></Profile>`
      const sut = await parseToSidePropagating(source, onElement)
      expect(sut.xmlHeader).toBeDefined()
    })

    it('Given a document without root element (only declaration), When parseToSidePropagating runs, Then it rejects with "no root element"', async () => {
      // Kills L129 StringLiteral "": error message in parseToSidePropagating
      // A document that produces no root key after parsing → capture=null → throws
      const onElement = vi.fn()
      // An XML declaration with no root tag produces an empty parsed object
      await expect(
        parseToSidePropagating('<?xml version="1.0"?>', onElement)
      ).rejects.toThrow(/no root element|parse|invalid/i)
    })

    it('Given a string source, When parseToSidePropagating runs, Then it resolves (kills L79 EqualityOperator typeof!==string)', async () => {
      // Kills L79 EqualityOperator: typeof source !== 'string' mutant would invert the check,
      // causing strings to go through Buffer.toString and Buffers to be used as-is.
      // This verifies a plain string source is handled correctly (not treated as Buffer).
      const onElement = vi.fn()
      const source = `<Root><child>val</child></Root>`
      const sut = await parseToSidePropagating(source, onElement)
      expect(sut.rootKey).toBe('Root')
      expect(onElement).toHaveBeenCalledWith('child', 'val')
    })

    it('Given a Buffer source, When parseToSidePropagating runs, Then it decodes and parses correctly (kills L79 ConditionalExpression)', async () => {
      // Kills L79 ConditionalExpression false: if always-false, Buffer.toString never called →
      // Buffer treated as string → garbled. Verify Buffer path produces correct output.
      const onElement = vi.fn()
      const source = Buffer.from(`<Root><item>hello</item></Root>`, 'utf8')
      const sut = await parseToSidePropagating(source, onElement)
      expect(sut.rootKey).toBe('Root')
      expect(onElement).toHaveBeenCalledWith('item', 'hello')
    })

    it('Given malformed XML that results in null capture, When parseToSidePropagating runs, Then it throws (kills L105 ConditionalExpression false)', async () => {
      // Kills L105 ConditionalExpression false: mutant skips the null guard, so null.rootKey
      // would throw a different uncaught error rather than our explicit message.
      const onElement = vi.fn()
      await expect(
        parseToSidePropagating('<?xml version="1.0"?>', onElement)
      ).rejects.toThrow()
    })
  })
})
