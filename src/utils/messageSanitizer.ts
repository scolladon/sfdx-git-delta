'use strict'

// Untrusted values (a raw --source-dir value, an accepted source scope) get
// echoed back verbatim into error/warning messages. Neither is guaranteed
// printable: an ANSI escape sequence survives into a terminal, a newline is
// a legal git path character that would forge an extra log line, and a
// bidi override (Cf, e.g. U+202E) or line/paragraph separator (U+2028,
// U+2029) can reverse or restructure the rendered line in a bidi-aware
// viewer (terminals, the GitHub Actions log viewer, browsers) — a Trojan
// Source-style attack. Strip all of these before the value reaches a
// message string, and cap the length so a single value cannot blow out the
// message.
const CONTROL_CHARS_REGEX = /[\p{Cc}\p{Cf}\u2028\u2029]/gu
const BACKSLASH_REGEX = /\\/g
const MAX_MESSAGE_VALUE_LENGTH = 200
const TRUNCATION_MARKER = '…'

// A fixed-width \xHH / \xHHHH escape is ambiguous: a 2-digit escape
// followed by two literal hex digits reads identically to a 4-digit one
// (e.g. escaping U+0006 next to a literal "00" and escaping U+0600 both
// produce "\x0600"), and astral format characters need a 5th digit anyway,
// so padding can never make every width uniform. The `\u{...}` delimited
// form is unambiguous at any width — the closing brace is the only valid
// terminator — and is itself valid ECMAScript escape syntax.
const escapeControlChar = (char: string): string => {
  // The regex only ever hands back a non-empty matched substring, so
  // codePointAt(0) is guaranteed to resolve.
  const codePoint = char.codePointAt(0)!
  return `\\u{${codePoint.toString(16)}}`
}

export const sanitizeForMessage = (value: string): string => {
  // Truncate on code points (not UTF-16 code units) before escaping: a
  // surrogate pair must never be split, and escaping only the already-
  // capped substring guarantees every emitted \u{...} escape is complete —
  // slicing an already-escaped string can otherwise cut mid-escape.
  const codePoints = Array.from(value)
  const isTruncated = codePoints.length > MAX_MESSAGE_VALUE_LENGTH
  const capped = isTruncated
    ? codePoints.slice(0, MAX_MESSAGE_VALUE_LENGTH).join('')
    : value
  // Escape literal backslashes first so a real control-char escape (which
  // is introduced afterwards) can never be confused with one that was
  // already present in the input — otherwise 'a\u{a}' and an actual
  // newline would sanitize to the same string.
  const escaped = capped
    .replace(BACKSLASH_REGEX, '\\\\')
    .replace(CONTROL_CHARS_REGEX, escapeControlChar)
  return isTruncated ? `${escaped}${TRUNCATION_MARKER}` : escaped
}
