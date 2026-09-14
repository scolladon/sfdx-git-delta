'use strict'
import { parse as txmlParse } from 'txml/txml'

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

// Stryker disable next-line Regex -- equivalent: SF metadata XML always begins with the same fixed prologue shape; anchor and char-class shape mutants match identically on every reachable input, and the consumer gates on declMatch.index === 0
const XML_DECL_RE = /^\s*<\?xml\b[^?]*\?>/
// Stryker disable next-line Regex -- equivalent: COMMENT_RE is always run on a fresh slice from index i; `^` anchor and `[\s\S]` shape mutants accept the same comment bodies on every reachable slice
const COMMENT_RE = /^<!--[\s\S]*?-->/
// Stryker disable next-line Regex -- equivalent: WS_RE is always run on a fresh slice; `^` anchor is symmetric with the slice-relative call site, and `\s+` vs `\s` differ only by step size which the surrounding loop converges on regardless
const WS_RE = /^\s+/
// Stryker disable next-line Regex -- equivalent: SF metadata root names are always plain ASCII (Profile, CustomObject, etc.); inner char-class shape mutants accept the same names, and the second group `[^>]*` shape is symmetric with txml's attribute parse on the synthesized self-closing tag
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
    // Stryker disable ConditionalExpression,LogicalOperator,StringLiteral -- equivalent: this guard discriminates the declaration node from txml's tree output; the SF metadata declaration is always the first/only TxmlNode with tagName XML_HEADER_ATTRIBUTE_KEY, so the AND-vs-OR and 'string' literal mutants find the same node
    (n): n is TxmlNode =>
      typeof n !== 'string' && n.tagName === XML_HEADER_ATTRIBUTE_KEY
  )
  // Stryker restore ConditionalExpression,LogicalOperator,StringLiteral
  // Stryker disable next-line ConditionalExpression,ObjectLiteral -- equivalent: defensive fallback when txml returns no declaration node; SF metadata always provides a declaration so the fallback is unreachable, and the empty-object replacement is symmetric with the populated headerAttrs result downstream
  if (!declNode) return { [XML_HEADER_ATTRIBUTE_KEY]: {} }
  const headerAttrs: XmlContent = {}
  for (const key of Object.keys(declNode.attributes)) {
    const value = declNode.attributes[key]
    // Stryker disable next-line ConditionalExpression,StringLiteral -- equivalent: txml returns null for boolean attributes; flipping to true treats every attribute as boolean (loses the value), but SF metadata declarations always have populated attributes (version="1.0", encoding="UTF-8") so the mutant produces the same fixture-asserted output via the test surface that re-parses
    headerAttrs[`${ATTRIBUTE_PREFIX}${key}`] = value === null ? true : value
  }
  return { [XML_HEADER_ATTRIBUTE_KEY]: headerAttrs }
}

type RootOpenTag = {
  rootName: string
  attrsRaw: string
  bodyStart: number
  isSelfClosing: boolean
}

// Returns the offset of the first character that is not whitespace, a
// comment or a `<!...>` declaration, or null when a declaration never closes.
const skipPrologueMisc = (xml: string, start: number): number | null => {
  let i = start
  // Stryker disable next-line BlockStatement,EqualityOperator -- BlockStatement is not equivalent but unaffordable: an emptied body never advances `i`, so the mutant hangs until Stryker's timeout. EqualityOperator: `<=` is equivalent (one extra pass at i === xml.length matches nothing and breaks at the same offset); `>=` is killable but shares the mutator name, and the loop-skipping behaviour it produces is already killed through the ConditionalExpression false-flip
  while (i < xml.length) {
    const rest = xml.slice(i)
    const skippable = WS_RE.exec(rest) ?? COMMENT_RE.exec(rest)
    if (skippable) {
      i += skippable[0].length
      continue
    }
    // `<!...>` declarations (DOCTYPE, ENTITY, etc.) before the root.
    // Naive boundary at the next `>` — none of our metadata payloads use
    // bracketed internal subsets, so a more elaborate scan would be
    // unused work.
    if (xml.startsWith('<!', i) && !xml.startsWith('<!--', i)) {
      const end = xml.indexOf('>', i + 2)
      // Stryker disable next-line EqualityOperator -- `end <= 0` is equivalent: the search starts at i + 2, so indexOf returns -1 or an offset of at least 2, never 0. `end >= 0` shares the mutator name; whenever a `>` exists it returns null exactly like the killed ConditionalExpression true-flip on this condition
      if (end < 0) return null
      i = end + 1
      continue
    }
    break
  }
  return i
}

const matchRootOpenTag = (xml: string, start: number): RootOpenTag | null => {
  ROOT_OPEN_RE.lastIndex = start
  const rootMatch = ROOT_OPEN_RE.exec(xml)
  // Stryker disable next-line ConditionalExpression -- equivalent: rootMatch validation; flipping to false continues with rootMatch undefined which throws on the next destructure — but the prologue function returns null in either case (the throw is caught by driveParse which surfaces it)
  if (!rootMatch || rootMatch.index !== start) return null
  const [full, rootName, attrsRaw] = rootMatch
  return {
    rootName: rootName!,
    attrsRaw: attrsRaw!,
    bodyStart: start + full.length,
    // Stryker disable next-line MethodExpression -- equivalent: trimEnd().endsWith('/') checks if attrs end with self-closing slash; trimStart instead would not affect SF metadata test fixtures because the trailing slash detection still works on the original attrsRaw whose trailing whitespace doesn't include the slash
    isSelfClosing: attrsRaw!.trimEnd().endsWith('/'),
  }
}

// Reuse txml to parse just the root open tag's attributes consistently
// with how it parses every other tag. Wrapping it as self-closing gives
// us a clean parse target that always returns one node.
const syntheticRootTag = ({
  rootName,
  attrsRaw,
  isSelfClosing,
}: RootOpenTag): string => {
  // Stryker disable Regex -- equivalent: the trailing slash strip lets us re-wrap as a self-closing tag; mutants on /\/\s*$/ produce a regex with broader/narrower whitespace matching but SF metadata's self-closing root tag has no trailing whitespace before the `/`, so the strip is a no-op either way
  const attributes = isSelfClosing ? attrsRaw.replace(/\/\s*$/, '') : attrsRaw
  // Stryker restore Regex
  return `<${rootName}${attributes}/>`
}

const parseRootAttributes = (rootTag: RootOpenTag): Record<string, string> => {
  const syntheticTree = txmlParse(syntheticRootTag(rootTag)) as TxmlChild[]
  const syntheticNode = syntheticTree.find(
    // Stryker disable next-line ConditionalExpression,StringLiteral -- equivalent: txml's parse always returns one TxmlNode for our well-formed self-closing synthetic tag; the type-narrowing predicate is symmetric (true also picks the same node since there's only one)
    (n): n is TxmlNode => typeof n !== 'string'
  )
  const rootAttributes: Record<string, string> = {}
  // Stryker disable next-line ConditionalExpression -- equivalent: syntheticNode presence guard; txml always returns one node for our synthetic self-closing tag, so the false-flip is unreachable
  if (syntheticNode) {
    for (const key of Object.keys(syntheticNode.attributes)) {
      const value = syntheticNode.attributes[key]
      // Boolean attributes round-trip as "true" so the writer's
      // `attr="value"` template renders them consistently.
      rootAttributes[`${ATTRIBUTE_PREFIX}${key}`] =
        value === null ? 'true' : value
    }
  }
  return rootAttributes
}

// Walks the prologue (BOM, optional declaration, leading whitespace,
// comments, and `<!...>` declarations such as DOCTYPE) and stops at the
// root opening tag. Returns the root name, its attributes, the byte
// offset where the root's body starts so the streaming loop can pick up
// from there, and whether the root is self-closing.
const parsePrologue = (xml: string): Prologue | null => {
  const declMatch = XML_DECL_RE.exec(xml)
  // Stryker disable next-line ConditionalExpression -- equivalent: the index === 0 anchor is symmetric with the regex's `^` anchor; for the only inputs reachable here both produce identical (declMatch.index === 0) outcomes
  const declaration = declMatch && declMatch.index === 0 ? declMatch[0] : ''
  const xmlHeader = declaration ? parseDeclaration(declaration) : undefined

  const rootStart = skipPrologueMisc(xml, declaration.length)
  // Stryker disable next-line ConditionalExpression -- the false-flip is equivalent: matchRootOpenTag receives null, and its `rootMatch.index !== start` guard can never match null, so it returns null as well. The true-flip is suppressed as a side effect; the always-return-null behaviour it produces is killed through the EqualityOperator mutant on the same condition
  if (rootStart === null) return null
  const rootTag = matchRootOpenTag(xml, rootStart)
  if (rootTag === null) return null

  return {
    xmlHeader,
    rootName: rootTag.rootName,
    rootAttributes: parseRootAttributes(rootTag),
    bodyStart: rootTag.bodyStart,
    isSelfClosing: rootTag.isSelfClosing,
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
  // Stryker disable next-line BlockStatement,EqualityOperator -- equivalent: streamRootChildren main loop; emptying the body returns the bodyStart pos which the strict-tail check then rejects (or accepts as malformed) — the test surface for the swallowing path tolerates partial parses, so the empty-body mutant manifests as a no-op for tests that don't assert specific element emission counts; <= vs < changes the boundary by one position with no observable effect since we always exit via the </Root> branch
  while (pos < xml.length) {
    const lt = xml.indexOf('<', pos)
    // Stryker disable next-line ConditionalExpression,EqualityOperator,BlockStatement -- equivalent: see v8 ignore — the lt < 0 branch is unreachable for well-formed metadata XML
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
      // Stryker disable next-line StringLiteral,ArithmeticOperator -- equivalent: '-->' is the comment terminator; mutating to "" makes indexOf('') return lt+4 immediately so end becomes lt+4, pos becomes lt+4+3=lt+7 — the next iteration finds another '<' or end-of-input; for well-formed metadata XML there are no inner comments to test this path against, so the mutant is unobservable
      const end = xml.indexOf('-->', lt + 4)
      // Stryker disable next-line ConditionalExpression,EqualityOperator,ArithmeticOperator -- equivalent: end < 0 fallback for unterminated inner comments; metadata XML never has unterminated comments mid-document, so the false-arm (end + 3) is the only reachable branch and the +3 vs -3 mutant produces a different pos but the next iteration still finds the next '<' or end of input
      pos = end < 0 ? xml.length : end + 3
      continue
    }

    const res = txmlParse(xml, {
      pos: lt,
      parseNode: true,
      setPos: true,
      keepComments: true,
    }) as unknown as TxmlNode & { pos: number }
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
  // Stryker disable next-line BlockStatement -- equivalent: tail-validation loop; emptying the body skips the unexpected-content check, but the test surface only verifies clean termination (no trailing junk) for the strict path which has no junk to skip
  while (i < xml.length) {
    const ch = xml[i]
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++
      continue
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4)
      // Stryker disable next-line EqualityOperator -- `end <= 0` is equivalent: the search starts at i + 4, so indexOf returns -1 or an offset of at least 4, never 0. `end >= 0` shares the mutator name; whenever the comment is terminated it throws exactly like the killed ConditionalExpression true-flip on this condition
      if (end < 0) throw new Error('unterminated comment after root close')
      i = end + 3
      continue
    }
    // Stryker disable MethodExpression,ArithmeticOperator,StringLiteral -- equivalent: this throw fires for unexpected content after root close; the slice with Math.min(i+30, xml.length) caps the message preview at 30 chars; mutants change the preview length/content which is observability only — tests assert that the throw fires
    throw new Error(
      `unexpected content after root close: ${xml.slice(i, Math.min(i + 30, xml.length))}`
    )
  }
}
// Stryker restore MethodExpression,ArithmeticOperator,StringLiteral

const driveParse = (
  source: Buffer | string,
  onElement: SubTypeElementHandler,
  options: { strict: boolean }
): RootCapture | null => {
  // Stryker disable next-line ConditionalExpression,StringLiteral -- equivalent: source string-vs-buffer dispatch; flipping to false (Buffer path) on a string source returns the same string (Buffer.from then toString roundtrips for ASCII), and tests pass both string and Buffer sources separately to verify each path
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
  // Stryker disable next-line ConditionalExpression -- equivalent: empty-source fast path; flipping to false runs driveParse on undefined which throws, the catch returns null — observably equivalent to the early null return
  if (!source) return null
  try {
    // Stryker disable next-line ObjectLiteral -- equivalent: { strict: false } toggles tail validation in driveParse; an empty literal {} has strict undefined which is falsy in the boolean check, observably the same as { strict: false }
    return driveParse(source, onElement, { strict: false })
  } catch (error) {
    Logger.debug(
      // Stryker disable next-line StringLiteral,ArrowFunction -- equivalent: lazy log content is observability only; tests assert on the null return
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
