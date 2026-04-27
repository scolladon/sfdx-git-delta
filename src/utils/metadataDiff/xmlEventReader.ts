'use strict'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error -- txml does not re-export its .d.ts via package.json exports
import { parse as txmlParse } from 'txml'

import { getErrorMessage } from '../errorUtils.js'
import { Logger, lazy } from '../LoggingService.js'
import {
  type TxmlChild,
  type TxmlNode,
  tNodeToXmlContent,
} from '../txmlAdapter.js'
import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  type XmlContent,
} from '../xmlHelper.js'

export type RootCapture = {
  xmlHeader: XmlContent | undefined
  rootKey: string
  rootAttributes: Record<string, string>
}

export type SubTypeElementHandler = (
  subType: string,
  element: XmlContent
) => void

const XML_DECL_RE = /^\s*<\?xml\b[^?]*\?>/
const COMMENT_RE = /^<!--[\s\S]*?-->/
const WS_RE = /^\s+/
const ROOT_OPEN_RE = /<([A-Za-z_:][\w.:-]*)([^>]*)>/y

type Prologue = {
  xmlHeader: XmlContent | undefined
  rootName: string
  rootAttributes: Record<string, string>
  bodyStart: number
  isSelfClosing: boolean
}

const parseDeclaration = (decl: string): XmlContent => {
  const tree = txmlParse(decl) as TxmlChild[]
  const declNode = tree.find(
    (n): n is TxmlNode =>
      typeof n !== 'string' && n.tagName === XML_HEADER_ATTRIBUTE_KEY
  )
  if (!declNode) return { [XML_HEADER_ATTRIBUTE_KEY]: {} }
  const headerAttrs: XmlContent = {}
  for (const key of Object.keys(declNode.attributes)) {
    const value = declNode.attributes[key]
    headerAttrs[`${ATTRIBUTE_PREFIX}${key}`] = value === null ? true : value
  }
  return { [XML_HEADER_ATTRIBUTE_KEY]: headerAttrs }
}

// Walks the prologue (BOM, optional declaration, leading whitespace,
// comments, and `<!...>` declarations such as DOCTYPE) and stops at the
// root opening tag. Returns the root name, its attributes, the byte
// offset where the root's body starts so the streaming loop can pick up
// from there, and whether the root is self-closing.
const parsePrologue = (xml: string): Prologue | null => {
  let i = 0
  let xmlHeader: XmlContent | undefined

  const declMatch = XML_DECL_RE.exec(xml)
  if (declMatch && declMatch.index === 0) {
    xmlHeader = parseDeclaration(declMatch[0])
    i += declMatch[0].length
  }

  while (i < xml.length) {
    const wsMatch = WS_RE.exec(xml.slice(i))
    if (wsMatch) {
      i += wsMatch[0].length
      continue
    }
    const commentMatch = COMMENT_RE.exec(xml.slice(i))
    if (commentMatch) {
      i += commentMatch[0].length
      continue
    }
    // `<!...>` declarations (DOCTYPE, ENTITY, etc.) before the root.
    // Naive boundary at the next `>` — none of our metadata payloads use
    // bracketed internal subsets, so a more elaborate scan would be
    // unused work.
    if (xml.startsWith('<!', i) && !xml.startsWith('<!--', i)) {
      const end = xml.indexOf('>', i + 2)
      if (end < 0) return null
      i = end + 1
      continue
    }
    break
  }

  ROOT_OPEN_RE.lastIndex = i
  const rootMatch = ROOT_OPEN_RE.exec(xml)
  if (!rootMatch || rootMatch.index !== i) return null
  const [full, rootName, attrsRaw] = rootMatch
  const isSelfClosing = attrsRaw!.trimEnd().endsWith('/')
  const bodyStart = i + full.length

  // Reuse txml to parse just the root open tag's attributes consistently
  // with how it parses every other tag. Wrapping it as self-closing gives
  // us a clean parse target that always returns one node.
  const synthetic = isSelfClosing
    ? `<${rootName!}${attrsRaw!.replace(/\/\s*$/, '')}/>`
    : `<${rootName!}${attrsRaw!}/>`
  const syntheticTree = txmlParse(synthetic) as TxmlChild[]
  const syntheticNode = syntheticTree.find(
    (n): n is TxmlNode => typeof n !== 'string'
  )
  const rootAttributes: Record<string, string> = {}
  if (syntheticNode) {
    for (const key of Object.keys(syntheticNode.attributes)) {
      const value = syntheticNode.attributes[key]
      // Boolean attributes round-trip as "true" so the writer's
      // `attr="value"` template renders them consistently.
      rootAttributes[`${ATTRIBUTE_PREFIX}${key}`] =
        value === null ? 'true' : value
    }
  }

  return {
    xmlHeader,
    rootName: rootName!,
    rootAttributes,
    bodyStart,
    isSelfClosing,
  }
}

// One-shot per-element parse via txml's parseNode primitive. We loop
// from bodyStart to the closing root tag, parsing exactly one direct
// child per iteration and emitting it through onElement before advancing
// the cursor. txml returns the parsed subtree fully built — but we drop
// our reference after onElement, so peak resident memory stays bounded
// by the largest single child rather than the full document.
//
// Returns the cursor position where the loop exited so the strict-mode
// caller can verify the root close tag and reject trailing content.
const streamRootChildren = (
  xml: string,
  bodyStart: number,
  onElement: SubTypeElementHandler
): number => {
  let pos = bodyStart
  while (pos < xml.length) {
    const lt = xml.indexOf('<', pos)
    /* v8 ignore next 4 -- defensive: well-formed XML always has the closing root tag, so '<' is reachable until the </Root> marker exits the loop below */
    if (lt < 0) {
      pos = xml.length
      break
    }

    if (xml.startsWith('</', lt)) {
      pos = lt
      break
    }

    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4)
      pos = end < 0 ? xml.length : end + 3
      continue
    }

    const res = txmlParse(xml, {
      pos: lt,
      parseNode: true,
      setPos: true,
      keepComments: true,
    }) as TxmlNode & { pos: number }
    onElement(res.tagName, tNodeToXmlContent(res) as XmlContent)
    pos = res.pos
  }
  return pos
}

// Strict-mode tail check: confirms the document closes with `</rootName>`
// (or is a self-closing root) and that only whitespace or comments
// follow. Covers what txml itself is too tolerant to flag — unclosed
// roots, multi-root documents, trailing junk after the root close.
const verifyTail = (
  xml: string,
  pos: number,
  rootName: string,
  isSelfClosing: boolean
): void => {
  let i = pos
  if (!isSelfClosing) {
    const expected = `</${rootName}>`
    if (!xml.startsWith(expected, i)) {
      throw new Error(
        `unclosed or mismatched root <${rootName}> at offset ${i}`
      )
    }
    i += expected.length
  }
  while (i < xml.length) {
    const ch = xml[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4)
      if (end < 0) throw new Error('unterminated comment after root close')
      i = end + 3
      continue
    }
    throw new Error(
      `unexpected content after root close: ${xml.slice(i, Math.min(i + 30, xml.length))}`
    )
  }
}

const driveParse = (
  source: Buffer | string,
  onElement: SubTypeElementHandler,
  options: { strict: boolean }
): RootCapture | null => {
  const payload = typeof source === 'string' ? source : source.toString('utf8')
  const prologue = parsePrologue(payload)
  if (prologue === null) return null
  const endPos = prologue.isSelfClosing
    ? prologue.bodyStart
    : streamRootChildren(payload, prologue.bodyStart, onElement)
  // Strict mode (to-side): confirm the input closes cleanly so the
  // MalformedXML warning path in the diff caller fires. Inner mismatches
  // already throw via txml's per-child parseNode. The swallowing path
  // skips this — its caller already discards errors and falls back to
  // "no prior content", so a partial parse is acceptable there.
  if (options.strict) {
    verifyTail(payload, endPos, prologue.rootName, prologue.isSelfClosing)
  }
  return {
    xmlHeader: prologue.xmlHeader,
    rootKey: prologue.rootName,
    rootAttributes: prologue.rootAttributes,
  }
}

/**
 * Parses the `from`-side blob for streaming diff ingestion. Errors and
 * empty/missing sources resolve to `null` — preserving the ADDITION path
 * where a missing `from` is treated as "no prior content" rather than a
 * failure.
 *
 * Emits `onElement(subType, element)` per direct-child element of the
 * document root, parsed one at a time via txml's parseNode primitive.
 * Peak resident memory stays bounded by the largest single child rather
 * than the full document because each parsed subtree is released as soon
 * as onElement returns and the cursor advances.
 */
export const parseFromSideSwallowing = async (
  source: Buffer | string | null | undefined,
  onElement: SubTypeElementHandler
): Promise<RootCapture | null> => {
  if (!source) return null
  try {
    return driveParse(source, onElement, { strict: false })
  } catch (error) {
    Logger.debug(
      lazy`parseFromSideSwallowing failed: ${() => getErrorMessage(error)}`
    )
    return null
  }
}

/**
 * Parses the `to`-side blob for streaming diff ingestion. Parse errors
 * propagate so the caller's `MalformedXML` warning path fires.
 *
 * Emits `onElement(subType, element)` per direct-child element of the
 * document root.
 */
export const parseToSidePropagating = async (
  source: Buffer | string,
  onElement: SubTypeElementHandler
): Promise<RootCapture> => {
  const capture = driveParse(source, onElement, { strict: true })
  if (capture === null) {
    throw new Error('to-side document has no root element')
  }
  return capture
}
