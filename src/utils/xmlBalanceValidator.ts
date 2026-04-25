'use strict'

/**
 * Lightweight well-formedness check for XML payloads.
 *
 * txml's parse is intentionally tolerant; the diff pipeline relies on
 * parse failure to surface a MalformedXML warning, so we run this
 * scanner first and throw if the input is not well-formed.
 *
 * One O(N) pass:
 *   - skips processing instructions
 *   - skips comments
 *   - skips CDATA literal sections
 *   - skips declarations such as DOCTYPE
 *   - tracks element nesting on a tag stack, requiring matched names
 *   - rejects multiple top-level elements
 */

export class MalformedXmlError extends Error {
  public override readonly name = 'MalformedXmlError'
  constructor(message: string) {
    super(message)
  }
}

const NAME_RE = /[A-Za-z_:][\w.:-]*/y

const readTagName = (xml: string, start: number): string | null => {
  NAME_RE.lastIndex = start
  const m = NAME_RE.exec(xml)
  return m ? m[0] : null
}

// Scans forward from `start` until the closing `>` of a tag, treating
// `"…"` and `'…'` as opaque so attribute values containing `>` or `<`
// (legal in XML 1.0 attribute syntax) don't fool the boundary finder.
const findTagEnd = (xml: string, start: number): number => {
  let i = start
  let quote: string | null = null
  while (i < xml.length) {
    const c = xml[i]
    if (quote !== null) {
      if (c === quote) quote = null
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '>') {
      return i
    }
    i++
  }
  return -1
}

export const validateXml = (xml: string): void => {
  const stack: string[] = []
  let sawRoot = false
  let i = 0

  while (i < xml.length) {
    const lt = xml.indexOf('<', i)
    if (lt < 0) break

    if (xml.startsWith('<?', lt)) {
      const end = xml.indexOf('?>', lt + 2)
      if (end < 0) {
        throw new MalformedXmlError('unterminated processing instruction')
      }
      i = end + 2
      continue
    }

    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt + 4)
      if (end < 0) throw new MalformedXmlError('unterminated comment')
      i = end + 3
      continue
    }

    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt + 9)
      if (end < 0) throw new MalformedXmlError('unterminated CDATA section')
      i = end + 3
      continue
    }

    if (xml.startsWith('<!', lt)) {
      const end = xml.indexOf('>', lt + 2)
      if (end < 0) throw new MalformedXmlError('unterminated declaration')
      i = end + 1
      continue
    }

    if (xml[lt + 1] === '/') {
      const name = readTagName(xml, lt + 2)
      if (name === null) {
        throw new MalformedXmlError(`malformed closing tag at offset ${lt}`)
      }
      const end = findTagEnd(xml, lt + 2 + name.length)
      if (end < 0) {
        throw new MalformedXmlError(`unterminated closing tag for ${name}`)
      }
      const top = stack.pop()
      if (top !== name) {
        throw new MalformedXmlError(
          `tag mismatch: closing ${name} but expected ${top ?? '(none)'}`
        )
      }
      i = end + 1
      continue
    }

    const name = readTagName(xml, lt + 1)
    if (name === null) {
      throw new MalformedXmlError(`malformed tag at offset ${lt}`)
    }
    const end = findTagEnd(xml, lt + 1 + name.length)
    if (end < 0) {
      throw new MalformedXmlError(`unterminated tag ${name}`)
    }
    const selfClosing = xml[end - 1] === '/'

    if (stack.length === 0 && sawRoot) {
      throw new MalformedXmlError(
        `multiple root elements: ${name} appears after the document root closed`
      )
    }
    sawRoot = true

    if (!selfClosing) {
      stack.push(name)
    }
    i = end + 1
  }

  if (stack.length > 0) {
    throw new MalformedXmlError(`unclosed tags: ${stack.join(', ')}`)
  }
}
