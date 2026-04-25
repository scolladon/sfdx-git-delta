'use strict'

import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'

import { readPathFromGit } from './fsHelper.js'

export type XmlContent = Record<string, unknown>

export const ATTRIBUTE_PREFIX = '@_'

export const XML_HEADER_ATTRIBUTE_KEY = '?xml'

// txmlAdapter consumes ATTRIBUTE_PREFIX + XML_HEADER_ATTRIBUTE_KEY at
// import time, so the import lives below their declarations to avoid the
// ordering hazard that comes with circular module init.
import { parseXml } from './txmlAdapter.js'

export const xml2Json = (xmlContent: string): XmlContent => parseXml(xmlContent)

export const parseXmlFileToJson = async (
  forRef: FileGitRef,
  config: Config
): Promise<XmlContent> => {
  const xmlContent = await readPathFromGit(forRef, config)
  return xml2Json(xmlContent)
}
