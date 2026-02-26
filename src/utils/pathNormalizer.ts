'use strict'

import { GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'
import { treatPathSep } from './fsUtils.js'

/**
 * Extracts and normalizes the file path from a git diff line.
 * Diff lines have format: "{A|M|D}\t{path}"
 * Ensures path uses forward slashes for consistent metadata lookup.
 */
export const extractPathFromDiffLine = (line: string): string => {
  const path = line.replace(GIT_DIFF_TYPE_REGEX, '')
  return treatPathSep(path)
}

/**
 * Normalizes a path for metadata lookup by ensuring consistent path separators.
 * Paths may come from diff lines, include-file, or source directory listing.
 */
export const normalizePathForMetadataLookup = (path: string): string => {
  return treatPathSep(path)
}
