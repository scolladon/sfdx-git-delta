'use strict'
import { once } from 'node:events'
import type { Writable } from 'node:stream'

import { ATTRIBUTE_PREFIX, type XmlContent } from '../xmlHelper.js'
import type { RootCapture } from './xmlEventReader.js'

const INDENT = '    '
const NEWLINE = '\n'
const COMMENT_KEY = '#comment'
// Buffer threshold for batching frame chunks before flushing to the
// underlying stream. ~8 KB matches a typical socket / pipe payload
// without forcing the writer to round-trip the event loop on every
// element. Picked to amortize the per-write overhead (Writable._write,
// drain bookkeeping) across ~50-100 frames for medium Profiles.
const FLUSH_THRESHOLD = 8 * 1024

// Pre-computed indent strings keyed by depth. XML is rarely deeper than
// 4-6 levels in Salesforce metadata, so this stays tiny. Lazily extended
// on first miss so deeper inputs still work without an upfront bound.
const indentCache: string[] = ['']
const indent = (depth: number): string => {
  let cached = indentCache[depth]
  if (cached === undefined) {
    for (let d = indentCache.length; d <= depth; d++) {
      indentCache[d] = indentCache[d - 1] + INDENT
    }
    cached = indentCache[depth]
  }
  return cached!
}

type ElementEntry = readonly [key: string, value: unknown]

type OpenFrame = {
  kind: 'open'
  name: string
  attributes: Record<string, string>
  children: ElementEntry[]
  depth: number
  closeTrailingNewline: boolean
}

type CloseFrame = {
  kind: 'close'
  name: string
  depth: number
  trailingNewline: boolean
}

type CommentFrame = {
  kind: 'comment'
  value: string
  depth: number
}

type LeafFrame = {
  kind: 'leaf'
  name: string
  attributes: Record<string, string>
  value: string
  depth: number
}

type EmptyFrame = {
  kind: 'empty'
  name: string
  attributes: Record<string, string>
  depth: number
  trailingNewline: boolean
}

type Frame = OpenFrame | CloseFrame | CommentFrame | LeafFrame | EmptyFrame

const renderAttrs = (attrs: Record<string, string>): string => {
  let out = ''
  for (const key of Object.keys(attrs)) {
    const bareName = key.slice(ATTRIBUTE_PREFIX.length)
    out += ` ${bareName}="${attrs[key]}"`
  }
  return out
}

const splitAttributesAndChildren = (
  content: XmlContent
): { attributes: Record<string, string>; children: ElementEntry[] } => {
  const attributes: Record<string, string> = {}
  const children: ElementEntry[] = []
  for (const key of Object.keys(content)) {
    const value = content[key]
    if (key.startsWith(ATTRIBUTE_PREFIX)) {
      attributes[key] = String(value)
      continue
    }
    children.push([key, value])
  }
  return { attributes, children }
}

const isPrimitive = (value: unknown): boolean =>
  value === null || value === undefined || typeof value !== 'object'

const toFrameForObjectChild = (
  key: string,
  value: XmlContent,
  depth: number
): Frame => {
  const { attributes, children } = splitAttributesAndChildren(value)
  if (children.length === 0) {
    return {
      kind: 'empty',
      name: key,
      attributes,
      depth,
      trailingNewline: true,
    }
  }
  return {
    kind: 'open',
    name: key,
    attributes,
    children,
    depth,
    closeTrailingNewline: true,
  }
}

const toFrameForPrimitiveChild = (
  key: string,
  value: unknown,
  depth: number
): LeafFrame => ({
  kind: 'leaf',
  name: key,
  attributes: {},
  value: value === undefined || value === null ? '' : String(value),
  depth,
})

const pushChildren = (
  stack: Frame[],
  children: ElementEntry[],
  depth: number
): void => {
  for (let i = children.length - 1; i >= 0; i--) {
    const [key, value] = children[i]
    if (key === COMMENT_KEY) {
      if (Array.isArray(value)) {
        for (let j = value.length - 1; j >= 0; j--) {
          stack.push({
            kind: 'comment',
            value: String(value[j]),
            depth,
          })
        }
      } else {
        stack.push({ kind: 'comment', value: String(value), depth })
      }
      continue
    }
    if (Array.isArray(value)) {
      for (let j = value.length - 1; j >= 0; j--) {
        stack.push(frameForChild(key, value[j], depth))
      }
      continue
    }
    stack.push(frameForChild(key, value, depth))
  }
}

const frameForChild = (key: string, value: unknown, depth: number): Frame => {
  if (isPrimitive(value)) return toFrameForPrimitiveChild(key, value, depth)
  return toFrameForObjectChild(key, value as XmlContent, depth)
}

// Buffered emitter: pushes frame fragments into a string until the
// FLUSH_THRESHOLD is crossed, then writes a single chunk to the
// underlying stream. Replaces the prior per-frame `out.write` which
// fired ~3 stream writes per element on large outputs (~thousands of
// writes per Profile prune). Backpressure is honoured at flush time:
// if `out.write` returns false we await the next `drain` before
// continuing — same semantics as before, just at coarser granularity.
class ChunkBuffer {
  private buffer = ''
  constructor(private readonly out: Writable) {}

  push(chunk: string): Promise<void> | void {
    this.buffer += chunk
    if (this.buffer.length >= FLUSH_THRESHOLD) {
      return this.flush()
    }
  }

  flush(): Promise<void> | void {
    if (this.buffer.length === 0) return
    const payload = this.buffer
    this.buffer = ''
    if (this.out.write(payload)) return
    return once(this.out, 'drain').then(() => undefined)
  }
}

const writeXmlDeclaration = async (
  buf: ChunkBuffer,
  xmlHeader: XmlContent | undefined
): Promise<void> => {
  if (!xmlHeader) return
  const decl = xmlHeader['?xml'] as XmlContent | undefined
  if (!decl) return
  const { attributes } = splitAttributesAndChildren(decl)
  await buf.push(`<?xml${renderAttrs(attributes)}?>${NEWLINE}`)
}

export type WriteOptions = {
  trailingNewline?: boolean
}

/**
 * Streams a generic XML document to `out`. Iterative depth-first traversal
 * with an explicit LIFO frame stack — safe under unexpectedly-deep input,
 * cancellation-friendly, back-pressure aware via drain-await per chunk.
 *
 * Output is byte-identical to `fast-xml-builder` when given the same
 * attribute prefix, comment key, and entity-passthrough (processEntities:
 * false) conventions as the rest of the project. See DESIGN.md \xc2\xa75.5.1.
 */
export const writeXmlDocument = async (
  out: Writable,
  rootCapture: RootCapture,
  rootChildren: ElementEntry[],
  options: WriteOptions = {}
): Promise<void> => {
  const buf = new ChunkBuffer(out)
  await writeXmlDeclaration(buf, rootCapture.xmlHeader)
  const trailingNewline = options.trailingNewline !== false
  const rootFrame: Frame =
    rootChildren.length === 0
      ? {
          kind: 'empty',
          name: rootCapture.rootKey,
          attributes: rootCapture.rootAttributes,
          depth: 0,
          trailingNewline,
        }
      : {
          kind: 'open',
          name: rootCapture.rootKey,
          attributes: rootCapture.rootAttributes,
          children: rootChildren,
          depth: 0,
          closeTrailingNewline: trailingNewline,
        }
  const stack: Frame[] = [rootFrame]
  while (stack.length > 0) {
    const frame = stack.pop()!
    await emitFrame(buf, frame, stack)
  }
  // Final flush — anything still buffered at end-of-document goes out
  // before the caller resolves.
  await buf.flush()
}

const emitFrame = async (
  buf: ChunkBuffer,
  frame: Frame,
  stack: Frame[]
): Promise<void> => {
  switch (frame.kind) {
    case 'open':
      await emitOpenFrame(buf, frame, stack)
      break
    case 'close':
      await buf.push(
        `${indent(frame.depth)}</${frame.name}>${frame.trailingNewline ? NEWLINE : ''}`
      )
      break
    case 'comment':
      await buf.push(`${indent(frame.depth)}<!--${frame.value}-->${NEWLINE}`)
      break
    case 'leaf':
      await buf.push(
        `${indent(frame.depth)}<${frame.name}${renderAttrs(frame.attributes)}>${frame.value}</${frame.name}>${NEWLINE}`
      )
      break
    case 'empty':
      await buf.push(
        `${indent(frame.depth)}<${frame.name}${renderAttrs(frame.attributes)}></${frame.name}>${frame.trailingNewline ? NEWLINE : ''}`
      )
      break
  }
}

const emitOpenFrame = async (
  buf: ChunkBuffer,
  frame: OpenFrame,
  stack: Frame[]
): Promise<void> => {
  await buf.push(
    `${indent(frame.depth)}<${frame.name}${renderAttrs(frame.attributes)}>${NEWLINE}`
  )
  stack.push({
    kind: 'close',
    name: frame.name,
    depth: frame.depth,
    trailingNewline: frame.closeTrailingNewline,
  })
  pushChildren(stack, frame.children, frame.depth + 1)
}
