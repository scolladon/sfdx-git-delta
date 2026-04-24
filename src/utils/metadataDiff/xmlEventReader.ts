'use strict'
import FlexXMLParser, { type X2jOptions } from '@nodable/flexible-xml-parser'

import { getErrorMessage } from '../errorUtils.js'
import { Logger, lazy } from '../LoggingService.js'
import {
  ATTRIBUTE_PREFIX,
  XML_HEADER_ATTRIBUTE_KEY,
  type XmlContent,
} from '../xmlHelper.js'
import { createStreamingBuilderFactory } from './streamingBuilder.js'

export type RootCapture = {
  xmlHeader: XmlContent | undefined
  rootKey: string
  rootAttributes: Record<string, string>
}

export type SubTypeElementHandler = (
  subType: string,
  element: XmlContent
) => void

const BASE_PARSER_OPTIONS: X2jOptions = {
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

const driveParse = (
  source: Buffer | string,
  onElement: SubTypeElementHandler
): RootCapture | null => {
  // A fresh parser per call is required: the streaming builder factory
  // captures the onElement callback in its builder instance, so reusing a
  // shared parser would leak callbacks across concurrent parses.
  // `OutputBuilder` is typed as `BaseOutputBuilderFactory` in X2jOptions
  // but our factory's method inheritance isn't visible on CompactBuilder-
  // Factory's .d.ts surface; cast through unknown to route around it.
  const parser = new FlexXMLParser({
    ...BASE_PARSER_OPTIONS,
    OutputBuilder: createStreamingBuilderFactory(onElement),
  } as unknown as X2jOptions)
  const payload = typeof source === 'string' ? source : source.toString('utf8')
  const parsed = parser.parse(payload) as XmlContent
  const rootKey = extractRootKey(parsed)
  if (rootKey === undefined) return null
  // The streaming builder has already emitted every direct-child element
  // via onElement and deleted it from `parsed[rootKey]`, so the returned
  // tree only carries the root's attributes and xml declaration.
  return buildRootCapture(parsed, rootKey)
}

/**
 * Parses the `from`-side blob for streaming diff ingestion. Errors and
 * empty/missing sources resolve to `null` — preserving the ADDITION path
 * where a missing `from` is treated as "no prior content" rather than a
 * failure.
 *
 * Emits `onElement(subType, element)` per direct-child element of the
 * document root as soon as that element's end tag is parsed. The
 * streaming builder drops each element from the in-progress tree after
 * emission so peak memory is bounded by the current element rather than
 * the full document. See DESIGN.md \xc2\xa75.2 and streamingBuilder.ts.
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
