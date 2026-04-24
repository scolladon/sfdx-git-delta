'use strict'
import { once } from 'node:events'
import type { Writable } from 'node:stream'

import { ATTRIBUTE_PREFIX, type XmlContent } from '../xmlHelper.js'
import type { RootCapture } from './xmlEventReader.js'

const INDENT = '    '
const NEWLINE = '\n'
const COMMENT_KEY = '#comment'

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

type TextFrame = {
  kind: 'text'
  value: string
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

type Frame =
  | OpenFrame
  | CloseFrame
  | TextFrame
  | CommentFrame
  | LeafFrame
  | EmptyFrame

const indent = (depth: number): string => INDENT.repeat(depth)

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

// Synchronous hot path: when the stream accepts the chunk without
// signalling backpressure, return undefined (caller awaits a non-promise,
// one microtask). When it signals backpressure we return a real drain
// promise. This keeps the per-frame cost low for large pruned XML.
const writeChunk = (out: Writable, chunk: string): Promise<void> | void => {
  if (out.write(chunk)) return
  return once(out, 'drain').then(() => undefined)
}

const writeXmlDeclaration = async (
  out: Writable,
  xmlHeader: XmlContent | undefined
): Promise<void> => {
  if (!xmlHeader) return
  const decl = xmlHeader['?xml'] as XmlContent | undefined
  if (!decl) return
  const { attributes } = splitAttributesAndChildren(decl)
  await writeChunk(out, `<?xml${renderAttrs(attributes)}?>${NEWLINE}`)
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
  await writeXmlDeclaration(out, rootCapture.xmlHeader)
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
    await emitFrame(out, frame, stack)
  }
}

const emitFrame = async (
  out: Writable,
  frame: Frame,
  stack: Frame[]
): Promise<void> => {
  switch (frame.kind) {
    case 'open':
      await emitOpenFrame(out, frame, stack)
      break
    case 'close':
      await writeChunk(
        out,
        `${indent(frame.depth)}</${frame.name}>${frame.trailingNewline ? NEWLINE : ''}`
      )
      break
    case 'text':
      await writeChunk(out, frame.value)
      break
    case 'comment':
      await writeChunk(
        out,
        `${indent(frame.depth)}<!--${frame.value}-->${NEWLINE}`
      )
      break
    case 'leaf':
      await writeChunk(
        out,
        `${indent(frame.depth)}<${frame.name}${renderAttrs(frame.attributes)}>${frame.value}</${frame.name}>${NEWLINE}`
      )
      break
    case 'empty':
      await writeChunk(
        out,
        `${indent(frame.depth)}<${frame.name}${renderAttrs(frame.attributes)}></${frame.name}>${frame.trailingNewline ? NEWLINE : ''}`
      )
      break
  }
}

const emitOpenFrame = async (
  out: Writable,
  frame: OpenFrame,
  stack: Frame[]
): Promise<void> => {
  await writeChunk(
    out,
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
