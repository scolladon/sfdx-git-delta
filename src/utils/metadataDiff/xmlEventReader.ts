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
import { validateXml } from '../xmlBalanceValidator.js'
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

// Walks the prologue (BOM, optional declaration, leading whitespace and
// comments) and stops at the root opening tag. Returns the root name,
// its attributes, and the byte offset where the root's body starts so
// the streaming loop can pick up from there.
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

  return { xmlHeader, rootName: rootName!, rootAttributes, bodyStart }
}

// One-shot per-element parse via txml's parseNode primitive. We loop
// from bodyStart to the closing root tag, parsing exactly one direct
// child per iteration and emitting it through onElement before advancing
// the cursor. txml returns the parsed subtree fully built — but we drop
// our reference after onElement, so peak resident memory stays bounded
// by the largest single child rather than the full document.
const streamRootChildren = (
  xml: string,
  bodyStart: number,
  onElement: SubTypeElementHandler
): void => {
  let pos = bodyStart
  while (pos < xml.length) {
    const lt = xml.indexOf('<', pos)
    /* v8 ignore next -- defensive: well-formed XML always has the closing root tag, so '<' is reachable until the </Root> marker exits the loop on L133 */
    if (lt < 0) break

    if (xml.startsWith('</', lt)) break

    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4)
      pos = end < 0 ? xml.length : end + 3
      continue
    }

    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9)
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
}

const driveParse = (
  source: Buffer | string,
  onElement: SubTypeElementHandler,
  options: { strict: boolean }
): RootCapture | null => {
  const payload = typeof source === 'string' ? source : source.toString('utf8')
  // Strict mode (to-side): reject malformed input up front so the
  // MalformedXML warning path in the diff caller fires. The
  // swallowing path skips this scan — its caller already discards
  // errors and falls back to "no prior content", so tolerating a
  // partial txml parse is fine and saves an O(N) prepass per file.
  if (options.strict) {
    validateXml(payload)
  }
  const prologue = parsePrologue(payload)
  if (prologue === null) return null
  streamRootChildren(payload, prologue.bodyStart, onElement)
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
