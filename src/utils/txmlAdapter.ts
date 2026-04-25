'use strict'

// txml ships .d.ts via `tXml.d.ts` but its package.json `exports` map only
// re-exports the runtime entry, so TypeScript can't pick the declarations
// up automatically. Declare the slice we use explicitly.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- type declarations not exposed via package exports
import { parse as txmlParse } from 'txml'

import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  type XmlContent,
} from './xmlHelper.js'

/**
 * Adapter from txml's flat AST (`(tNode | string)[]`) to our compact
 * `XmlContent` shape:
 *   { '@_attr': value, child: <content>, '#comment': string|string[] }
 *
 * Conventions matched against the previous FlexXMLParser configuration
 * so existing handlers and `xmlWriter.ts` keep round-tripping unchanged:
 *   - attributes are prefixed `@_` (ATTRIBUTE_PREFIX)
 *   - boolean attributes (no value) are emitted as `true`
 *   - element text is trimmed; whitespace-only text between elements is
 *     dropped (txml default)
 *   - comments are collapsed under the `#comment` key (string or string[]
 *     when more than one comment lives at the same depth)
 *   - the XML declaration `<?xml ...?>` is collapsed to a `?xml` key
 *   - elements with the same tagName at the same depth collapse to an array
 */

export type TxmlNode = {
  tagName: string
  attributes: Record<string, string | null>
  children: TxmlChild[]
}

export type TxmlChild = TxmlNode | string

const COMMENT_KEY = '#comment'
const COMMENT_PREFIX = '<!--'
const COMMENT_SUFFIX = '-->'

const isComment = (child: TxmlChild): child is string =>
  typeof child === 'string' && child.startsWith(COMMENT_PREFIX)

const isText = (child: TxmlChild): child is string =>
  typeof child === 'string' && !child.startsWith(COMMENT_PREFIX)

const stripComment = (raw: string): string =>
  raw.slice(COMMENT_PREFIX.length, raw.length - COMMENT_SUFFIX.length)

const renderAttributes = (
  attributes: Record<string, string | null>
): XmlContent => {
  const out: XmlContent = {}
  for (const key of Object.keys(attributes)) {
    const value = attributes[key]
    // FlexXMLParser emitted boolean attributes (no value) as `true`; txml
    // emits them as `null`. Map back to `true` so downstream code (and the
    // xmlWriter, which renders `attr="value"` from the value's `String(...)`
    // representation) keeps the same shape.
    out[`${ATTRIBUTE_PREFIX}${key}`] = value === null ? true : value
  }
  return out
}

// `addChild(out, key, child)` collapses repeated tag names at the same
// depth into an array — first repeat upgrades the slot from scalar to
// array, subsequent repeats append.
const addChild = (out: XmlContent, key: string, child: unknown): void => {
  const existing = out[key]
  if (existing === undefined) {
    out[key] = child
    return
  }
  if (Array.isArray(existing)) {
    existing.push(child)
    return
  }
  out[key] = [existing, child]
}

const addComment = (out: XmlContent, text: string): void => {
  const existing = out[COMMENT_KEY]
  if (existing === undefined) {
    out[COMMENT_KEY] = text
    return
  }
  if (Array.isArray(existing)) {
    existing.push(text)
    return
  }
  out[COMMENT_KEY] = [existing, text]
}

// Convert a single tNode into the value our compact format uses for it.
// Three cases:
//   - empty element  → {} (so xmlWriter emits `<tag></tag>`)
//   - text-only leaf → primitive string
//   - everything else (attributes, children, mixed) → XmlContent object
export const tNodeToXmlContent = (node: TxmlNode): unknown => {
  const attributes = renderAttributes(node.attributes)
  const hasAttributes = Object.keys(attributes).length > 0

  if (node.children.length === 0) {
    return hasAttributes ? attributes : {}
  }

  // Text-only leaf: a single text child and no attributes collapse to the
  // primitive string. Attributes-bearing leaves keep object form so the
  // writer can render them with attributes.
  if (
    !hasAttributes &&
    node.children.length === 1 &&
    isText(node.children[0]!)
  ) {
    return node.children[0] as string
  }

  const out: XmlContent = { ...attributes }
  for (const child of node.children) {
    if (isComment(child)) {
      addComment(out, stripComment(child))
      continue
    }
    if (typeof child === 'string') {
      // Mixed content (text + elements) is rare in our payloads but kept
      // verbatim so a future use case isn't silently dropped.
      addChild(out, '#text', child)
      continue
    }
    addChild(out, child.tagName, tNodeToXmlContent(child))
  }
  return out
}

/**
 * Parses XML text into our compact JSON shape. Empty input short-circuits
 * to `{}`; malformed input (parse throws) is swallowed and also yields
 * `{}` — preserving the existing `xml2Json` contract.
 */
export const parseXml = (xmlContent: string): XmlContent => {
  if (!xmlContent) return {}
  try {
    const tree = txmlParse(xmlContent, {
      keepComments: true,
    }) as TxmlChild[]
    const out: XmlContent = {}
    for (const child of tree) {
      if (isComment(child)) {
        addComment(out, stripComment(child))
        continue
      }
      if (typeof child === 'string') continue // top-level whitespace
      if (child.tagName === XML_HEADER_ATTRIBUTE_KEY) {
        out[XML_HEADER_ATTRIBUTE_KEY] = renderAttributes(child.attributes)
        continue
      }
      addChild(out, child.tagName, tNodeToXmlContent(child))
    }
    return out
  } catch {
    return {}
  }
}
