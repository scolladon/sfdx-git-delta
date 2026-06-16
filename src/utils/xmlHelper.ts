'use strict'

export type XmlContent = Record<string, unknown>

export const ATTRIBUTE_PREFIX = '@_'

export const XML_HEADER_ATTRIBUTE_KEY = '?xml'

/**
 * Escapes the XML-significant characters in raw element text content.
 *
 * Only for values built from raw domain data (e.g. package.xml member names),
 * never for content read back through the txml passthrough reader — that
 * content is already escaped and re-escaping it would corrupt the round-trip.
 * The ampersand is replaced first so the entities introduced afterwards are
 * not double-escaped. Quotes are valid unescaped in element text, so they are
 * intentionally left untouched.
 */
export const escapeXmlText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
