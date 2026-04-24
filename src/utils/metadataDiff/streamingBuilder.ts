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

// Private-field contract bridged in a single cast so upstream changes in
// @nodable/compact-builder produce one obvious failure site (asserted below),
// not three silent `undefined` reads.
type BuilderInternals = {
  tagsStack: unknown[]
  tagName: string
  value: Record<string, unknown>
}

function assertInternals(
  internals: BuilderInternals
): asserts internals is BuilderInternals {
  if (
    !Array.isArray(internals.tagsStack) ||
    typeof internals.tagName !== 'string' ||
    internals.value === null ||
    typeof internals.value !== 'object'
  ) {
    throw new Error(
      'streamingBuilder: CompactBuilder internals changed — upgrade the wrapper'
    )
  }
}

const wrapStreaming = (
  base: CompactBuilder,
  onElement: SubTypeElementHandler
): CompactBuilder => {
  const originalClose = base.closeElement.bind(base)
  const internals: BuilderInternals = base as unknown as BuilderInternals
  assertInternals(internals)
  base.closeElement = function (matcher: unknown) {
    const stackLenBefore = internals.tagsStack.length
    const closingTag = internals.tagName
    originalClose(matcher)
    if (stackLenBefore !== ROOT_CHILD_STACK_DEPTH) return
    const parent = internals.value
    const added = parent[closingTag]
    if (added === undefined) return
    onElement(closingTag, added as XmlContent)
    delete parent[closingTag]
  }
  return base
}
