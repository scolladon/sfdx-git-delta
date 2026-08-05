'use strict'

// Untrusted values (a raw --source-dir value, an accepted source scope) get
// echoed back verbatim into error/warning messages. Neither is guaranteed
// printable: an ANSI escape sequence survives into a terminal, and a
// newline is a legal git path character that would forge an extra log
// line. Strip control characters before either reaches a message string,
// and cap the length so a single value cannot blow out the message.
const CONTROL_CHARS_REGEX = /\p{Cc}/gu
const MAX_MESSAGE_VALUE_LENGTH = 200
const TRUNCATION_MARKER = '…'

const escapeControlChar = (char: string): string =>
  `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`

export const sanitizeForMessage = (value: string): string => {
  const escaped = value.replace(CONTROL_CHARS_REGEX, escapeControlChar)
  return escaped.length > MAX_MESSAGE_VALUE_LENGTH
    ? `${escaped.slice(0, MAX_MESSAGE_VALUE_LENGTH)}${TRUNCATION_MARKER}`
    : escaped
}
