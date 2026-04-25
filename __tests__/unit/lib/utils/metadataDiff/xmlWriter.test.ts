'use strict'
import { PassThrough } from 'node:stream'

import { describe, expect, it } from 'vitest'

import type { RootCapture } from '../../../../../src/utils/metadataDiff/xmlEventReader'
import { writeXmlDocument } from '../../../../../src/utils/metadataDiff/xmlWriter'

const collect = async (
  produce: (out: PassThrough) => Promise<void>
): Promise<string> => {
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)))
  await produce(stream)
  stream.end()
  return Buffer.concat(chunks).toString('utf8')
}

const xmlHeader = {
  '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
}

const profileCapture: RootCapture = {
  xmlHeader,
  rootKey: 'Profile',
  rootAttributes: { '@_xmlns': 'http://soap.sforce.com/2006/04/metadata' },
}

describe('writeXmlDocument', () => {
  it('Given an empty root child list, When the writer runs, Then root renders as single-line <Root></Root>', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [])
    })

    // Assert
    expect(out).toBe(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata"></Profile>\n`
    )
  })

  it('Given a single keyed element, When the writer runs, Then leaf children render as inline <tag>value</tag> lines', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        [
          'fieldPermissions',
          {
            field: 'Account.Name',
            editable: 'true',
            readable: 'true',
          },
        ],
      ])
    })

    // Assert
    expect(out).toBe(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n    <fieldPermissions>\n        <field>Account.Name</field>\n        <editable>true</editable>\n        <readable>true</readable>\n    </fieldPermissions>\n</Profile>\n`
    )
  })

  it('Given an array of elements under one key, When the writer runs, Then elements render in insertion order', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        [
          'fieldPermissions',
          [
            { field: 'A', editable: 'true', readable: 'true' },
            { field: 'B', editable: 'false', readable: 'true' },
          ],
        ],
      ])
    })

    // Assert
    const firstIdx = out.indexOf('<field>A</field>')
    const secondIdx = out.indexOf('<field>B</field>')
    expect(firstIdx).toBeGreaterThan(0)
    expect(secondIdx).toBeGreaterThan(firstIdx)
  })

  it('Given a comment child, When the writer runs, Then it renders as <!--value--> at the child indent', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['#comment', ' a comment '],
      ])
    })

    // Assert
    expect(out).toContain(`    <!-- a comment -->\n`)
  })

  it('Given an element with an attribute, When the writer runs, Then the attribute is emitted with double-quoted value on the open tag', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        [
          'recordTypes',
          {
            '@_category': 'Master',
            fullName: 'Default',
          },
        ],
      ])
    })

    // Assert
    expect(out).toContain(`<recordTypes category="Master">`)
    expect(out).toContain(`<fullName>Default</fullName>`)
  })

  it('Given an empty child element, When the writer runs, Then it renders as <name></name> rather than self-closed', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [['emptyTag', {}]])
    })

    // Assert
    expect(out).toContain(`    <emptyTag></emptyTag>\n`)
  })

  it('Given raw entity text in a value, When the writer runs, Then entities are preserved unchanged', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['description', 'a &amp; b &lt; c'],
      ])
    })

    // Assert
    expect(out).toContain(`<description>a &amp; b &lt; c</description>`)
  })

  it('Given options.trailingNewline is false, When the writer runs, Then no trailing newline follows the close tag', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [], {
        trailingNewline: false,
      })
    })

    // Assert
    expect(out.endsWith(`</Profile>`)).toBe(true)
    expect(out.endsWith(`</Profile>\n`)).toBe(false)
  })

  it('Given deeply nested content, When the writer runs, Then depth-based indentation is correct at each level', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        [
          'recordTypes',
          {
            fullName: 'Default',
            values: {
              name: 'Master',
              fields: { label: 'Title' },
            },
          },
        ],
      ])
    })

    // Assert
    expect(out).toContain(`    <recordTypes>`)
    expect(out).toContain(`        <fullName>Default</fullName>`)
    expect(out).toContain(`        <values>`)
    expect(out).toContain(`            <name>Master</name>`)
    expect(out).toContain(`            <fields>`)
    expect(out).toContain(`                <label>Title</label>`)
  })

  it('Given a synthetic 1,000-level-deep input, When the writer runs, Then it does not throw RangeError', async () => {
    // Arrange - build a deeply nested object without recursion
    let deep: unknown = 'leaf'
    for (let i = 0; i < 1_000; i++) {
      deep = { child: deep }
    }
    const stream = new PassThrough()
    stream.on('data', () => undefined) // drain
    let error: unknown
    try {
      // Act
      await writeXmlDocument(
        stream,
        {
          xmlHeader: undefined,
          rootKey: 'Root',
          rootAttributes: {},
        },
        [['child', deep]],
        { trailingNewline: false }
      )
    } catch (err) {
      error = err
    }
    stream.end()

    // Assert
    expect(error).toBeUndefined()
  })

  it('Given a capture without xmlHeader, When the writer runs, Then no declaration is emitted', async () => {
    // Arrange
    const capture: RootCapture = {
      xmlHeader: undefined,
      rootKey: 'Root',
      rootAttributes: {},
    }

    // Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, capture, [])
    })

    // Assert
    expect(out.startsWith('<Root>')).toBe(true)
  })

  it('Given an array-of-comments child, When the writer runs, Then each comment is emitted in order', async () => {
    // Arrange & Act
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['#comment', [' first ', ' second ']],
      ])
    })

    // Assert
    const firstIdx = out.indexOf(`<!-- first -->`)
    const secondIdx = out.indexOf(`<!-- second -->`)
    expect(firstIdx).toBeGreaterThan(0)
    expect(secondIdx).toBeGreaterThan(firstIdx)
  })

  it('Given a null primitive child value, When the writer runs, Then an empty leaf is emitted', async () => {
    // Kills L128 ConditionalExpression/LogicalOperator: value===undefined||value===null → ''
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [['nullField', null]])
    })
    expect(out).toContain(`<nullField></nullField>`)
  })

  it('Given an undefined primitive child value, When the writer runs, Then an empty leaf is emitted', async () => {
    // Kills L128 LogicalOperator: value===undefined&&value===null would be false for undefined
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['undefinedField', undefined],
      ])
    })
    expect(out).toContain(`<undefinedField></undefinedField>`)
  })

  it('Given a numeric primitive child value, When the writer runs, Then it is stringified in the leaf', async () => {
    // Kills L128 ConditionalExpression: String(value) branch must be taken for non-null/undef
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [['count', 42]])
    })
    expect(out).toContain(`<count>42</count>`)
  })

  it('Given renderAttrs is given an attribute key, When the writer runs, Then the prefix is stripped from the attribute name', async () => {
    // Kills L93 isPrimitive null/undefined check: attribute extraction branch in renderAttrs
    const out = await collect(async stream => {
      await writeXmlDocument(
        stream,
        {
          xmlHeader: undefined,
          rootKey: 'Root',
          rootAttributes: { '@_myAttr': 'val' },
        },
        []
      )
    })
    expect(out).toContain(`myAttr="val"`)
    expect(out).not.toContain('@_')
  })

  it('Given close frame with trailingNewline false, When the writer runs, Then no newline after closing tag', async () => {
    // Kills L183 ConditionalExpression: trailingNewline on CloseFrame — triggered by
    // options.trailingNewline=false propagating into close frame
    const out = await collect(async stream => {
      await writeXmlDocument(
        stream,
        { xmlHeader: undefined, rootKey: 'Root', rootAttributes: {} },
        [['child', { field: 'v' }]],
        { trailingNewline: false }
      )
    })
    // The close tag of Root must not end with \n
    expect(out.endsWith(`</Root>`)).toBe(true)
  })

  it('Given empty frame with trailingNewline false (root is empty), When the writer runs, Then no newline after root tag', async () => {
    // Kills L248 StringLiteral "": trailingNewline conditional on EmptyFrame
    const out = await collect(async stream => {
      await writeXmlDocument(
        stream,
        { xmlHeader: undefined, rootKey: 'Root', rootAttributes: {} },
        [],
        { trailingNewline: false }
      )
    })
    expect(out.endsWith(`</Root>`)).toBe(true)
    expect(out.endsWith(`</Root>\n`)).toBe(false)
  })

  it('Given an ArithmeticOperator mutant on pushChildren depth, When a child element is rendered, Then its indent is depth+1 not depth', async () => {
    // Kills L141 ArithmeticOperator: value.length + 1 → value.length - 1 would collapse indent
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['parent', { child: 'value' }],
      ])
    })
    // parent at depth 1 → 4 spaces; child at depth 2 → 8 spaces
    expect(out).toContain(`    <parent>`)
    expect(out).toContain(`        <child>value</child>`)
  })

  it('Given close frame trailingNewline true (default), When the writer runs, Then closing tag ends with newline', async () => {
    // Kills L183 ConditionalExpression false: trailingNewline conditional on CloseFrame.
    // Default trailingNewline=true → closing tag must end with \n.
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['fieldPermissions', { field: 'A' }],
      ])
    })
    // The </fieldPermissions> close tag must be followed by a newline
    expect(out).toMatch(/<\/fieldPermissions>\n/)
  })

  it('Given close frame with trailingNewline explicitly false on inner close, When the writer runs with no-newline option, Then root closing tag has no newline', async () => {
    // Kills L183 ConditionalExpression: trailingNewline false → no \n after </Root>
    const out = await collect(async stream => {
      await writeXmlDocument(
        stream,
        { xmlHeader: undefined, rootKey: 'Root', rootAttributes: {} },
        [['item', { leaf: 'v' }]],
        { trailingNewline: false }
      )
    })
    // Root close must NOT end with newline
    expect(out.endsWith('</Root>')).toBe(true)
    expect(out.endsWith('</Root>\n')).toBe(false)
    // But inner close (</item>) DOES get a trailing newline (its own frame has trailingNewline=true)
    expect(out).toMatch(/<\/item>\n/)
  })

  it('Given empty root frame with trailingNewline true (default), When the writer runs, Then empty root tag ends with newline', async () => {
    // Kills L248 StringLiteral "": the empty frame trailing-newline conditional must emit \n
    // when trailingNewline is true (default).
    const out = await collect(async stream => {
      await writeXmlDocument(
        stream,
        { xmlHeader: undefined, rootKey: 'Root', rootAttributes: {} },
        []
      )
    })
    expect(out.endsWith('<Root></Root>\n')).toBe(true)
  })

  it('Given open frame emitted, When the writer runs, Then opening tag ends with newline before children', async () => {
    // Kills L93 ConditionalExpression false in emitFrame (open branch): the open tag must
    // be followed by NEWLINE for proper formatting.
    const out = await collect(async stream => {
      await writeXmlDocument(stream, profileCapture, [
        ['parent', { childA: 'x', childB: 'y' }],
      ])
    })
    // Opening tag of parent must be followed immediately by \n
    expect(out).toMatch(/<parent>\n/)
    // Both children on their own indented lines
    expect(out).toContain(`        <childA>x</childA>`)
    expect(out).toContain(`        <childB>y</childB>`)
  })
})
