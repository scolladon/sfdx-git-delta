import type { Metadata } from '../src/types/metadata.ts'

// The registry is edited as text rather than regenerated so hand-written
// comments and field order survive. It is matched line by line because no
// stable TypeScript parse API is available as a dependency; positional
// matching plus the xmlName cross-check guards against the text and the
// imported array drifting apart.

const SPAN_OPENER = '  {'
const SPAN_CLOSER = '  },'
const XML_NAME_LINE = /^ {4}xmlName: '([^']*)',$/

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
    `internalRegistry.ts entry ${index}: expected xmlName '${entries[index]!.xmlName}', found '${spans[index]!.xmlName}'`
  )
}

export function removeEntries(
  source: string,
  entries: readonly Metadata[],
  removable: ReadonlySet<number>
): string {
  const lines = source.split('\n')
  const spans = findSpans(lines)
  assertSpansMatch(spans, entries)
  const dropped = new Set<number>()
  spans.forEach((span, position) => {
    if (!removable.has(position)) return
    for (let index = span.start; index <= span.end; index++) dropped.add(index)
  })
  return lines.filter((_, index) => !dropped.has(index)).join('\n')
}
