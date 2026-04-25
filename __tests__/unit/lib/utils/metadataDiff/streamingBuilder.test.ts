'use strict'
import { describe, expect, it, vi } from 'vitest'

import { createStreamingBuilderFactory } from '../../../../../src/utils/metadataDiff/streamingBuilder'
import {
  parseFromSideSwallowing,
  parseToSidePropagating,
} from '../../../../../src/utils/metadataDiff/xmlEventReader'

vi.mock('../../../../../src/utils/LoggingService')

const SIMPLE_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <field>Account.Name</field>
    <editable>true</editable>
  </fieldPermissions>
  <userLicense>Salesforce</userLicense>
</Profile>`

const NESTED_PROFILE = `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
  <fieldPermissions>
    <field>Account.Name</field>
    <nested>
      <deep>value</deep>
    </nested>
  </fieldPermissions>
</Profile>`

describe('createStreamingBuilderFactory', () => {
  it('Given valid XML with two direct root children, When parsed, Then onElement fires exactly twice', async () => {
    // Kills L91 ConditionalExpression false: stackLenBefore !== ROOT_CHILD_STACK_DEPTH
    // Mutant "false" would skip the emission guard, emitting nothing (or emitting at all depths)
    const calls: Array<[string, unknown]> = []
    const onElement = vi.fn((subType: string, element: unknown) => {
      calls.push([subType, element])
    })
    await parseFromSideSwallowing(SIMPLE_PROFILE, onElement)
    expect(calls).toHaveLength(2)
    expect(calls[0][0]).toBe('fieldPermissions')
    expect(calls[1][0]).toBe('userLicense')
  })

  it('Given XML with deeply nested elements, When parsed, Then onElement is NOT fired for inner elements', async () => {
    // Kills L91 ConditionalExpression: depth guard prevents sub-root emission
    const calls: Array<[string, unknown]> = []
    const onElement = vi.fn((subType: string, element: unknown) => {
      calls.push([subType, element])
    })
    await parseFromSideSwallowing(NESTED_PROFILE, onElement)
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('fieldPermissions')
    expect(calls.map(([t]) => t)).not.toContain('nested')
    expect(calls.map(([t]) => t)).not.toContain('deep')
  })

  it('Given parsed document, When onElement fires, Then the child is removed from tree (not retained in rootCapture)', async () => {
    // Kills L91 delete branch: emitted child must be removed from parent
    const onElement = vi.fn()
    const capture = await parseToSidePropagating(SIMPLE_PROFILE, onElement)
    // Post-streaming: root capture must not retain emitted children
    expect(Object.keys(capture.rootAttributes)).not.toContain(
      'fieldPermissions'
    )
    expect(Object.keys(capture.rootAttributes)).not.toContain('userLicense')
  })

  it('Given createStreamingBuilderFactory with default options, When called, Then it does not throw', () => {
    // Kills L63 BlockStatement {}: assertInternals must execute without throwing on valid builder
    const onElement = vi.fn()
    expect(() => createStreamingBuilderFactory(onElement)).not.toThrow()
  })

  it('Given createStreamingBuilderFactory with explicit builderOptions, When called, Then it does not throw', () => {
    // Confirms builderOptions param accepted (kills trivial factory construction path)
    const onElement = vi.fn()
    expect(() =>
      createStreamingBuilderFactory(onElement, { trim: true })
    ).not.toThrow()
  })

  it('Given a single root child element, When parsed, Then onElement receives the element content', async () => {
    // Kills L91 ConditionalExpression variants: element value must be non-undefined
    const source = `<Root><child><key>val</key></child></Root>`
    const calls: Array<[string, unknown]> = []
    const onElement = vi.fn((subType: string, element: unknown) => {
      calls.push([subType, element])
    })
    await parseFromSideSwallowing(source, onElement)
    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toBe('child')
    expect(calls[0][1]).toMatchObject({ key: 'val' })
  })
})
