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
// Forward full-text search bound: scans 252 entries per miss, which recovers
// deletion runs of up to 254 children and caps the per-miss cost.
const RESYNC_LOOKAHEAD = 256
// Reorder-heavy files stop paying lookups: a miss reads at most about 256
// entries, and after this many consecutive misses no entry is read again.
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
    return this.entries[index]
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

const TAG_CLOSE = '>'

// A complete child ends on a tag close strictly inside the document. txml can
// report a positive length for an unterminated <script> or <style>, whose text
// is then a fragment that must never be matched as a prefix.
const endsInsideDocument = (
  xml: string,
  lt: number,
  child: ParsedChild
): boolean => {
  const end = lt + child.length
  if (xml[end - 1] !== TAG_CLOSE) return false
  // Stryker disable next-line ConditionalExpression,LogicalOperator,EqualityOperator -- equivalent once the tag-close test above passed: txml's no-progress result (-1) and a cut child (one past the end) both fail that test, so the length is already positive; a child ending exactly at the end of input ends on '>' and is complete, and reusing it yields what txml parses
  return child.length > 0 && end < xml.length
}

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
const probesMatch = (xml: string, lt: number, text: string): boolean => {
  const last = text.length - 1
  const middle = last >> 1
  // Stryker disable next-line ConditionalExpression,LogicalOperator,EqualityOperator -- equivalent: the probes only reject early and startsWithEntry still requires xml.startsWith, so any mutant that lets more entries through changes no result; the false-flip shares the mutator name and is killed by every reuse test
  return xml[lt + last] === text[last] && xml[lt + middle] === text[middle]
}

const startsWithEntry = (xml: string, lt: number, text: string): boolean => {
  return probesMatch(xml, lt, text) && xml.startsWith(text, lt)
}

export class ReusingChildParser implements ChildParser {
  private cursor = 0
  private misses = 0

  constructor(private readonly recorded: RecordedChildrenView) {}

  parseAt(xml: string, lt: number): ParsedChild {
    const hit = this.reusableAt(xml, lt)
    if (hit !== NO_HIT) {
      this.advancePast(hit)
      return this.recorded.at(hit)
    }
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

  private advancePast(index: number): void {
    this.cursor = index + 1
    this.misses = 0
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
