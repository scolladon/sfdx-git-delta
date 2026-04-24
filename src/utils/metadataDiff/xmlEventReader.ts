'use strict'
import FlexXMLParser, { type X2jOptions } from '@nodable/flexible-xml-parser'

import { getErrorMessage } from '../errorUtils.js'
import { Logger, lazy } from '../LoggingService.js'
import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  type XmlContent,
} from '../xmlHelper.js'

export type RootCapture = {
  xmlHeader: XmlContent | undefined
  rootKey: string
  rootAttributes: Record<string, string>
}

export type SubTypeElementHandler = (
  subType: string,
  element: XmlContent
) => void

const STREAMING_PARSER_OPTION: X2jOptions = {
  skip: {
    attributes: false,
    nsPrefix: false,
    comment: false,
    declaration: false,
  },
  nameFor: {
    comment: '#comment',
  },
  attributes: {
    prefix: ATTRIBUTE_PREFIX,
    valueParsers: [] as unknown[],
  },
  tags: {
    valueParsers: ['trim'] as unknown[],
  },
} as X2jOptions

const streamingParser = new FlexXMLParser(STREAMING_PARSER_OPTION)

const isAttributeKey = (key: string): boolean =>
  key.startsWith(ATTRIBUTE_PREFIX)

const buildRootCapture = (parsed: XmlContent, rootKey: string): RootCapture => {
  const rootNode = (parsed[rootKey] as XmlContent | undefined) ?? {}
  const rootAttributes: Record<string, string> = {}
  for (const key of Object.keys(rootNode)) {
    if (isAttributeKey(key)) {
      rootAttributes[key] = String(rootNode[key])
    }
  }
  const declContent = parsed[XML_HEADER_ATTRIBUTE_KEY] as XmlContent | undefined
  const xmlHeader: XmlContent | undefined =
    declContent === undefined
      ? undefined
      : { [XML_HEADER_ATTRIBUTE_KEY]: declContent }
  return { xmlHeader, rootKey, rootAttributes }
}

const extractRootKey = (parsed: XmlContent): string | undefined =>
  Object.keys(parsed).find(key => key !== XML_HEADER_ATTRIBUTE_KEY)

const emitSubTypeElements = (
  rootNode: XmlContent,
  onElement: SubTypeElementHandler
): void => {
  for (const subType of Object.keys(rootNode)) {
    if (isAttributeKey(subType)) continue
    const raw = rootNode[subType]
    const elements = Array.isArray(raw) ? raw : [raw]
    for (const element of elements) {
      onElement(subType, element as XmlContent)
    }
  }
}

const parseBuffer = (source: Buffer | string): XmlContent =>
  streamingParser.parse(
    typeof source === 'string' ? source : source.toString('utf8')
  ) as XmlContent

const driveParse = (
  source: Buffer | string,
  onElement: SubTypeElementHandler
): RootCapture | null => {
  const parsed = parseBuffer(source)
  const rootKey = extractRootKey(parsed)
  if (rootKey === undefined) return null
  const rootCapture = buildRootCapture(parsed, rootKey)
  const rootNode = (parsed[rootKey] as XmlContent | undefined) ?? {}
  emitSubTypeElements(rootNode, onElement)
  return rootCapture
}

/**
 * Parses the `from`-side blob for streaming diff ingestion. Errors and
 * empty/missing sources resolve to `null` — preserving the ADDITION path
 * where a missing `from` is treated as "no prior content" rather than a
 * failure.
 *
 * Emits `onElement(subType, element)` per direct-child element of the
 * document root.
 */
export const parseFromSideSwallowing = async (
  source: Buffer | string | null | undefined,
  onElement: SubTypeElementHandler
): Promise<RootCapture | null> => {
  if (!source) return null
  try {
    return driveParse(source, onElement)
  } catch (error) {
    Logger.debug(
      lazy`parseFromSideSwallowing failed: ${() => getErrorMessage(error)}`
    )
    return null
  }
}

/**
 * Parses the `to`-side blob for streaming diff ingestion. Parse errors
 * propagate so the caller's `MalformedXML` warning path fires.
 *
 * Emits `onElement(subType, element)` per direct-child element of the
 * document root.
 */
export const parseToSidePropagating = async (
  source: Buffer | string,
  onElement: SubTypeElementHandler
): Promise<RootCapture> => {
  const capture = driveParse(source, onElement)
  if (capture === null) {
    throw new Error('to-side document has no root element')
  }
  return capture
}
