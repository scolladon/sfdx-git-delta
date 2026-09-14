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

// Some network errors echo the offending proxy verbatim, credentials included:
// proxy-agent's "Unsupported protocol for proxy URL: <url>" carries a URL's
// user:password userinfo, and pac-proxy-agent's "Failed to establish a socket
// connection to proxies: [...]" lists a PAC resolver's entries as written.
// Redact both before the value reaches a message; both patterns stay linear
// because they run on network-supplied text before any length cap.
//
// The URL userinfo match runs up to the last '@' before an authority terminator
// ('/', '?', '#') and deliberately crosses whitespace, because a URL parser
// accepts a password with a space in it; over-redacting a later '@' fails safe.
// The scheme is capped at 32 characters: an uncapped scheme backtracks
// quadratically on a long letter run.
const URL_USERINFO_REGEX = /([a-z][a-z\d+.-]{0,31}:\/{2,})[^/?#]*@/gi
// A PAC entry has no scheme to anchor on, so its keyword anchors instead,
// matched case-insensitively because a mis-cased entry is rejected yet still
// echoed. \S* cannot cross whitespace, and every entry separates its keyword
// from its target with some, so a match never runs into the next entry and
// stays linear. Ordinary text shaped like a keyword followed by "<word>@" is
// over-redacted, which fails safe.
const PAC_ENTRY_USERINFO_REGEX = /\b((?:PROXY|HTTPS?|SOCKS[45]?)\s+)\S*@/gi
// Still not covered, and why each stays open. A raw '/', '?' or '#' inside a
// password is echoed only under a scheme proxy-agent rejects, with nothing but
// digits before the delimiter; closing it would redact URL paths. A special
// scheme written with fewer than two slashes ("ftp:user:pass@host") reaches a
// message only when the value also carries a later "://", because
// proxy-from-env prefixes a scheme to any value without one; closing it would
// mean matching any "word:" followed by an '@' in ordinary message text.
const REDACTED_USERINFO = '<redacted>'

export const redactProxyCredentials = (value: string): string =>
  value
    .replace(URL_USERINFO_REGEX, `$1${REDACTED_USERINFO}@`)
    .replace(PAC_ENTRY_USERINFO_REGEX, `$1${REDACTED_USERINFO}@`)

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
