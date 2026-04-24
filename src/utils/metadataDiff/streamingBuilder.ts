'use strict'
import { CompactBuilder, CompactBuilderFactory } from '@nodable/compact-builder'

import type { XmlContent } from '../xmlHelper.js'
import type { SubTypeElementHandler } from './xmlEventReader.js'

// Direct-child-of-root elements close when `tagsStack.length === 2`: the
// synthetic wrapper root is at depth 0 and the document root is at depth 1,
// so a depth-2 stack means we're closing one of the root's direct children.
const ROOT_CHILD_STACK_DEPTH = 2

/**
 * OutputBuilder factory that emits each direct child of the document root
 * as soon as its end tag is parsed, then removes the element from the
 * in-progress tree so the parser never accumulates the whole document.
 * Peak memory is bounded by the current element being built — DESIGN Q2.
 *
 * Subclassing CompactBuilder is deliberate: the factory still builds
 * attributes, CDATA, comments, entity-preserving value chains the same way
 * the default does. Only `closeElement` is intercepted — after super
 * populates `this.value[tagName]`, we hand that child to `onElement` and
 * `delete` it from the parent so the in-progress tree stays empty.
 */
export const createStreamingBuilderFactory = (
  onElement: SubTypeElementHandler,
  builderOptions: Record<string, unknown> = {}
) => new StreamingBuilderFactory(onElement, builderOptions)

class StreamingBuilderFactory extends CompactBuilderFactory {
  constructor(
    private readonly onElement: SubTypeElementHandler,
    builderOptions: Record<string, unknown>
  ) {
    super(builderOptions)
  }

  override getInstance(
    parserOptions: unknown,
    readonlyMatcher: unknown
  ): CompactBuilder {
    const base = super.getInstance(
      parserOptions as never,
      readonlyMatcher as never
    )
    return wrapStreaming(base, this.onElement)
  }
}

const wrapStreaming = (
  base: CompactBuilder,
  onElement: SubTypeElementHandler
): CompactBuilder => {
  const originalClose = base.closeElement.bind(base)
  base.closeElement = function (matcher: unknown) {
    const stackLenBefore = (base as unknown as { tagsStack: unknown[] })
      .tagsStack.length
    const closingTag = (base as unknown as { tagName: string }).tagName
    originalClose(matcher)
    if (stackLenBefore !== ROOT_CHILD_STACK_DEPTH) return
    const parent = (base as unknown as { value: Record<string, unknown> }).value
    const added = parent[closingTag]
    if (added === undefined) return
    const element = Array.isArray(added)
      ? (added[0] as XmlContent)
      : (added as XmlContent)
    onElement(closingTag, element ?? ({} as XmlContent))
    delete parent[closingTag]
  }
  return base
}
