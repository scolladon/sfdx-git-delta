'use strict'
import { describe, expect, it, vi } from 'vitest'

import {
  type RecordedChild,
  RecordedChildren,
  type RecordedChildrenView,
  RecordingChildParser,
  ReusingChildParser,
} from '../../../../../src/utils/metadataDiff/childReuse'
import {
  parseFromSideSwallowing,
  parseToSidePropagating,
} from '../../../../../src/utils/metadataDiff/xmlEventReader'

vi.mock('../../../../../src/utils/LoggingService')

type Collected = Array<[string, unknown]>

const doc = (children: readonly string[]) => `<R>${children.join('')}</R>`
const entry = (i: number) => `<e><n>${i}</n></e>`
const fresh = (i: number) => `<f><n>${i}</n></f>`
const range = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, i) => from + i)
const entries = (from: number, to: number) => range(from, to).map(entry)

const collector = () => {
  const seen: Collected = []
  return {
    seen,
    handler: (subType: string, element: unknown) => {
      seen.push([subType, element])
    },
  }
}

const replayDocs = async (
  from: readonly string[],
  to: readonly string[],
  view: (recorded: RecordedChildren) => RecordedChildrenView = recorded =>
    recorded
) => {
  const recorded = new RecordedChildren()
  const fromSide = collector()
  const toSide = collector()
  await parseFromSideSwallowing(
    doc(from),
    fromSide.handler,
    new RecordingChildParser(recorded)
  )
  const sut = new ReusingChildParser(view(recorded))
  await parseToSidePropagating(doc(to), toSide.handler, sut)
  return { from: fromSide.seen, to: toSide.seen, recorded }
}

class CountingView implements RecordedChildrenView {
  reads = 0
  private inner = new RecordedChildren()

  wrap(inner: RecordedChildren): void {
    this.inner = inner
  }

  get size(): number {
    return this.inner.size
  }

  at(index: number): RecordedChild {
    this.reads++
    return this.inner.at(index)
  }
}

const elementAt = (seen: Collected, index: number) => seen[index]![1]

describe('Given a ReusingChildParser over recorded from-side children', () => {
  it('When a to child is identical, Then it is reused', async () => {
    // Arrange
    const children = entries(0, 3)

    // Act
    const result = await replayDocs(children, children)

    // Assert
    result.to.forEach((_, i) =>
      expect(elementAt(result.to, i)).toBe(elementAt(result.from, i))
    )
  })

  it('When a to child equals the entry at cursor+3, Then it is reused', async () => {
    // Arrange
    const from = entries(0, 5)

    // Act
    const result = await replayDocs(from, [entry(3)])

    // Assert
    expect(elementAt(result.to, 0)).toBe(elementAt(result.from, 3))
  })

  it('When a to child equals the entry at cursor+4, Then it is parsed', async () => {
    // Arrange
    const from = entries(0, 6)

    // Act
    const result = await replayDocs(from, [entry(4)])

    // Assert
    expect(elementAt(result.to, 0)).not.toBe(elementAt(result.from, 4))
    expect(elementAt(result.to, 0)).toEqual(elementAt(result.from, 4))
  })

  it('When comments sit between children, Then reuse continues across them', async () => {
    // Arrange
    const from = [entry(0), '<!-- c -->', entry(1)]

    // Act
    const result = await replayDocs(from, from)

    // Assert
    expect(elementAt(result.to, 1)).toBe(elementAt(result.from, 1))
  })

  it.each([
    ['self-closing', '<userLicense/>'],
    ['with attributes', '<a b="1">t</a>'],
    ['wrapping CDATA', '<w><value><![CDATA[a<b>]]></value></w>'],
  ])('When the child is %s, Then it is reused', async (_, child) => {
    // Arrange
    const from = [child, entry(0)]

    // Act
    const result = await replayDocs(from, from)

    // Assert
    expect(typeof elementAt(result.from, 0)).toBe('object')
    expect(elementAt(result.to, 0)).toBe(elementAt(result.from, 0))
  })

  it('When a child is modified in place, Then it is parsed and the next child is reused', async () => {
    // Arrange
    const from = entries(0, 3)

    // Act
    const result = await replayDocs(from, [entry(0), fresh(1), entry(2)])

    // Assert
    expect(elementAt(result.to, 1)).not.toBe(elementAt(result.from, 1))
    expect(elementAt(result.to, 2)).toBe(elementAt(result.from, 2))
  })

  it('When a run of children is inserted, Then the next original child is reused', async () => {
    // Arrange
    const from = entries(0, 3)
    const to = [entry(0), fresh(0), fresh(1), fresh(2), entry(1), entry(2)]

    // Act
    const result = await replayDocs(from, to)

    // Assert
    expect(elementAt(result.to, 4)).toBe(elementAt(result.from, 1))
    expect(elementAt(result.to, 5)).toBe(elementAt(result.from, 2))
  })

  it('When a from child is duplicated and the to side repeats it as often, Then each occurrence reuses its own entry in order', async () => {
    // Arrange
    const [a, d, b] = entries(0, 3) as [string, string, string]
    const docs = [a, d, d, b]

    // Act
    const result = await replayDocs(docs, docs)

    // Assert
    expect(elementAt(result.to, 1)).toBe(elementAt(result.from, 1))
    expect(elementAt(result.to, 2)).toBe(elementAt(result.from, 2))
    expect(elementAt(result.to, 1)).not.toBe(elementAt(result.to, 2))
  })

  it('When the to side repeats it once more than the from side, Then the extra one is parsed fresh', async () => {
    // Arrange
    const [a, d, b] = entries(0, 3) as [string, string, string]

    // Act
    const result = await replayDocs([a, d, b], [a, d, d, b])

    // Assert
    expect(elementAt(result.to, 1)).toBe(elementAt(result.from, 1))
    expect(elementAt(result.to, 2)).not.toBe(elementAt(result.from, 1))
    expect(elementAt(result.to, 2)).toEqual(elementAt(result.from, 1))
    expect(elementAt(result.to, 3)).toBe(elementAt(result.from, 2))
  })
})

describe('Given a ReusingChildParser resynchronising after misses', () => {
  it('When four or more children are deleted, Then the second miss resyncs: that child is parsed and the following child is reused', async () => {
    // Arrange
    const from = entries(0, 9)

    // Act
    const result = await replayDocs(from, [
      entry(0),
      entry(6),
      entry(7),
      entry(8),
    ])

    // Assert
    expect(elementAt(result.to, 1)).not.toBe(elementAt(result.from, 6))
    expect(elementAt(result.to, 2)).not.toBe(elementAt(result.from, 7))
    expect(elementAt(result.to, 3)).toBe(elementAt(result.from, 8))
  })

  it('When the second consecutive miss equals the entry at cursor+255, Then the next child in from order is reused', async () => {
    // Arrange
    const from = entries(0, 260)
    const to = [entry(0), fresh(0), entry(256), entry(257)]

    // Act
    const result = await replayDocs(from, to)

    // Assert
    expect(elementAt(result.to, 3)).toBe(elementAt(result.from, 257))
  })

  it('When the second consecutive miss equals the entry at cursor+256, Then the next child is parsed', async () => {
    // Arrange
    const from = entries(0, 261)
    const to = [entry(0), fresh(0), entry(257), entry(258)]

    // Act
    const result = await replayDocs(from, to)

    // Assert
    expect(elementAt(result.to, 3)).not.toBe(elementAt(result.from, 258))
  })
})

describe('Given a ReusingChildParser giving up after consecutive misses', () => {
  const misses = (count: number) => range(0, count).map(fresh)

  it('When 512 consecutive misses precede a child equal to the entry at the cursor, Then it is parsed', async () => {
    // Arrange
    const to = [...misses(512), entry(0)]

    // Act
    const result = await replayDocs([entry(0)], to)

    // Assert
    expect(elementAt(result.to, 512)).not.toBe(elementAt(result.from, 0))
  })

  it('When 511 consecutive misses precede a child equal to the entry at the cursor, Then it is reused', async () => {
    // Arrange
    const to = [...misses(511), entry(0)]

    // Act
    const result = await replayDocs([entry(0)], to)

    // Assert
    expect(elementAt(result.to, 511)).toBe(elementAt(result.from, 0))
  })

  it('When the recorded children are read through a counting view and 700 to children all miss, Then no entry is read after the 512th miss', async () => {
    // Arrange
    const counting = new CountingView()
    const recorded = new RecordedChildren()
    await parseFromSideSwallowing(
      doc(entries(0, 600)),
      collector().handler,
      new RecordingChildParser(recorded)
    )
    counting.wrap(recorded)
    let readsAtGiveUp = -1
    let received = 0
    const onElement = () => {
      received++
      if (received === 512) readsAtGiveUp = counting.reads
    }

    // Act
    await parseToSidePropagating(
      doc(misses(700)),
      onElement,
      new ReusingChildParser(counting)
    )

    // Assert
    expect(readsAtGiveUp).toBeGreaterThan(0)
    expect(counting.reads).toBe(readsAtGiveUp)
  })

  it('When the from side is empty, Then every to child is parsed and no entry is read', async () => {
    // Arrange
    const counting = new CountingView()
    counting.wrap(new RecordedChildren())
    const toSide = collector()

    // Act
    await parseToSidePropagating(
      doc(entries(0, 3)),
      toSide.handler,
      new ReusingChildParser(counting)
    )

    // Assert
    expect(toSide.seen).toHaveLength(3)
    expect(counting.reads).toBe(0)
  })
})

describe('Given a ReusingChildParser comparing near-identical children', () => {
  it.each([
    ['same length, last and middle character', '<v>AmB</v>', '<v>CmD</v>'],
    ['a different last character', '<v a="1"/>', '<v a="1">z</v>'],
    ['a different middle character', '<v a="1"/>', '<v b="1"/>'],
  ])(
    'When a to child has %s but different text, Then it is not reused',
    async (_, fromChild, toChild) => {
      // Arrange
      const from = [fromChild]
      const to = [toChild]

      // Act
      const result = await replayDocs(from, to)

      // Assert
      expect(elementAt(result.to, 0)).not.toEqual(elementAt(result.from, 0))
    }
  )

  it('When the to document has inserted, deleted, moved and modified children, Then the handler receives the same sequence as with the plain parser', async () => {
    // Arrange
    const from = entries(0, 12)
    const to = [
      entry(0),
      fresh(0),
      entry(3),
      entry(2),
      entry(8),
      fresh(1),
      fresh(2),
      entry(9),
      entry(1),
      entry(11),
    ]
    const plain = collector()
    await parseToSidePropagating(doc(to), plain.handler)

    // Act
    const result = await replayDocs(from, to)

    // Assert
    expect(result.to).toEqual(plain.seen)
  })
})

describe('Given a RecordingChildParser', () => {
  it('When the from document is cut inside its last child, Then every complete child is recorded and the cut one is not', async () => {
    // Arrange
    const recorded = new RecordedChildren()
    const sut = new RecordingChildParser(recorded)
    const cut = `<R>${entry(0)}${entry(1)}<e><n>2`

    // Act
    await parseFromSideSwallowing(cut, collector().handler, sut)

    // Assert
    expect(recorded.size).toBe(2)
  })

  it("When parseAt runs on a child whose close tag has no '>', Then nothing is recorded", () => {
    // Arrange
    const recorded = new RecordedChildren()
    const sut = new RecordingChildParser(recorded)

    // Act
    sut.parseAt('<R><a>x</a', 3)

    // Assert
    expect(recorded.size).toBe(0)
  })
})
