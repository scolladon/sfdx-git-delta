'use strict'
import {
  type ChildParser,
  type ParsedChild,
  PLAIN_CHILD_PARSER,
} from './xmlEventReader.js'

// Measured on a 3.5 MB / 21,735-child Profile and a 351 KB labels file.
// Entries tried by prefix per child: absorbs up to 3 deleted children with no resync.
const REUSE_WINDOW = 4
// One miss is usually an in-place edit (the next child realigns); two in a
// row signal an insert/delete run.
const RESYNC_AFTER_MISSES = 2
// Forward full-text search bound: recovers deletion runs of up to 252
// children and caps the per-miss cost.
const RESYNC_LOOKAHEAD = 256
// Reorder-heavy files stop paying lookups: worst case is about 131k entry
// reads per file.
const GIVE_UP_AFTER_MISSES = 512

export type RecordedChild = ParsedChild & Readonly<{ text: string }>

export type RecordedChildrenView = Readonly<{
  size: number
  at(index: number): RecordedChild
}>

export class RecordedChildren implements RecordedChildrenView {
  private readonly entries: RecordedChild[] = []

  get size(): number {
    return this.entries.length
  }

  at(index: number): RecordedChild {
    return this.entries[index] as RecordedChild
  }

  record(entry: RecordedChild): void {
    this.entries.push(entry)
  }
}

const recordOf = (
  xml: string,
  lt: number,
  child: ParsedChild
): RecordedChild => {
  const text = xml.slice(lt, lt + child.length)
  return {
    tagName: child.tagName,
    content: child.content,
    text,
    length: text.length,
  }
}

const endsInsideDocument = (
  xml: string,
  lt: number,
  child: ParsedChild
): boolean => child.length > 0 && lt + child.length < xml.length

export class RecordingChildParser implements ChildParser {
  constructor(private readonly recorded: RecordedChildren) {}

  parseAt(xml: string, lt: number): ParsedChild {
    const child = PLAIN_CHILD_PARSER.parseAt(xml, lt)
    if (endsInsideDocument(xml, lt, child)) {
      this.recorded.record(recordOf(xml, lt, child))
    }
    return child
  }
}

const NO_HIT = -1

// Cheap single-character probes reject most non-matching entries before the
// full prefix comparison.
const startsWithEntry = (xml: string, lt: number, text: string): boolean => {
  const last = text.length - 1
  return (
    xml[lt + last] === text[last] &&
    xml[lt + (last >> 1)] === text[last >> 1] &&
    xml.startsWith(text, lt)
  )
}

export class ReusingChildParser implements ChildParser {
  private cursor = 0
  private misses = 0

  constructor(private readonly recorded: RecordedChildrenView) {}

  parseAt(xml: string, lt: number): ParsedChild {
    const hit = this.reusableAt(xml, lt)
    if (hit !== NO_HIT) return this.reuse(hit)
    const child = PLAIN_CHILD_PARSER.parseAt(xml, lt)
    this.noteMiss(xml.slice(lt, lt + child.length))
    return child
  }

  private gaveUp(): boolean {
    return this.misses >= GIVE_UP_AFTER_MISSES
  }

  private reusableAt(xml: string, lt: number): number {
    if (this.gaveUp()) return NO_HIT
    const end = Math.min(this.recorded.size, this.cursor + REUSE_WINDOW)
    for (let i = this.cursor; i < end; i++) {
      if (startsWithEntry(xml, lt, this.recorded.at(i).text)) return i
    }
    return NO_HIT
  }

  private reuse(index: number): RecordedChild {
    this.cursor = index + 1
    this.misses = 0
    return this.recorded.at(index)
  }

  private noteMiss(text: string): void {
    if (this.gaveUp()) return
    this.misses++
    if (this.misses >= RESYNC_AFTER_MISSES) this.cursor = this.resyncAfter(text)
  }

  private resyncAfter(text: string): number {
    const end = Math.min(this.recorded.size, this.cursor + RESYNC_LOOKAHEAD)
    for (let i = this.cursor + REUSE_WINDOW; i < end; i++) {
      if (this.recorded.at(i).text === text) return i + 1
    }
    return this.cursor
  }
}
