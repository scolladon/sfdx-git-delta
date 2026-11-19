import type { Metadata } from '../src/types/metadata.ts'

// The registry is edited as text rather than regenerated so hand-written
// comments and field order survive. It is matched line by line because no
// stable TypeScript parse API is available as a dependency; positional
// matching plus the xmlName cross-check guards against the text and the
// imported array drifting apart.

const SPAN_OPENER = '  {'
const SPAN_CLOSER = '  },'
const XML_NAME_LINE = /^ {4}xmlName: '([^']*)',$/
const COMMENT_LINE = /^\s*\/\//
const CRLF = '\r\n'

// Section headers and an entry's own comment both sit right after the previous
// entry, so position cannot tell them apart. This header is the only block
// allowed above a removable entry; it stays for the next gap-filler. Matching
// it verbatim fails closed: an edited header makes the sync refuse.
export const GAP_FILLER_SECTION_HEADER: readonly string[] = [
  '  // SDR gap-fillers: types not yet in SDR registry.',
  '  // Automatically removed by tooling/syncInternalRegistryWithSdr.ts when SDR adds them.',
]

type EntrySpan = {
  readonly start: number
  readonly end: number
  readonly xmlName: string | undefined
}

const spanXmlName = (
  lines: readonly string[],
  start: number,
  end: number
): string | undefined => {
  for (let index = start + 1; index < end; index++) {
    const match = XML_NAME_LINE.exec(lines[index]!)
    if (match) return match[1]
  }
  return undefined
}

const findSpans = (lines: readonly string[]): readonly EntrySpan[] => {
  const spans: EntrySpan[] = []
  let start: number | undefined
  lines.forEach((line, index) => {
    if (line === SPAN_OPENER) {
      start = index
      return
    }
    if (line !== SPAN_CLOSER || start === undefined) return
    spans.push({ start, end: index, xmlName: spanXmlName(lines, start, index) })
    start = undefined
  })
  return spans
}

const assertLineEndings = (source: string): void => {
  if (!source.includes(CRLF)) return
  throw new Error(
    'internalRegistry.ts uses CRLF line endings; check it out with LF line endings'
  )
}

const assertSpansMatch = (
  spans: readonly EntrySpan[],
  entries: readonly Metadata[]
): void => {
  if (spans.length !== entries.length) {
    throw new Error(
      `internalRegistry.ts has ${spans.length} entry spans but exports ${entries.length} entries; keep every entry expanded on its own lines`
    )
  }
  const index = spans.findIndex(
    (span, position) => span.xmlName !== entries[position]!.xmlName
  )
  if (index === -1) return
  throw new Error(
    `internalRegistry.ts entry ${index}: expected xmlName '${entries[index]!.xmlName}', found '${spans[index]!.xmlName}'; keep entries Biome-formatted (npm run lint:fix) with xmlName on its own single-quoted line`
  )
}

const leadingComment = (
  lines: readonly string[],
  start: number
): readonly string[] => {
  const above = lines.slice(0, start)
  const lastCode = above.findLastIndex(line => !COMMENT_LINE.test(line))
  return above.slice(lastCode + 1)
}

const isGapFillerSectionHeader = (comment: readonly string[]): boolean =>
  comment.length === GAP_FILLER_SECTION_HEADER.length &&
  comment.every((line, index) => line === GAP_FILLER_SECTION_HEADER[index])

const assertNoOwnComment = (
  lines: readonly string[],
  span: EntrySpan,
  position: number
): void => {
  const comment = leadingComment(lines, span.start)
  if (comment.length === 0 || isGapFillerSectionHeader(comment)) return
  throw new Error(
    `internalRegistry.ts entry ${position} ('${span.xmlName}') is removable but has its own comment above it; move or delete that comment, then re-run the sync`
  )
}

export function removeEntries(
  source: string,
  entries: readonly Metadata[],
  removable: ReadonlySet<number>
): string {
  assertLineEndings(source)
  const lines = source.split('\n')
  const spans = findSpans(lines)
  assertSpansMatch(spans, entries)
  const removed = spans.flatMap((span, position) =>
    removable.has(position) ? [{ span, position }] : []
  )
  for (const { span, position } of removed) {
    assertNoOwnComment(lines, span, position)
  }
  const dropped = new Set<number>()
  for (const { span } of removed) {
    for (let index = span.start; index <= span.end; index++) dropped.add(index)
  }
  return lines.filter((_, index) => !dropped.has(index)).join('\n')
}
