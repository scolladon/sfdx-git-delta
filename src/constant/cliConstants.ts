import { HEAD } from './gitConstants.js'

export const TO_DEFAULT_VALUE = HEAD
export const OUTPUT_DEFAULT_VALUE = './output'
export const SOURCE_DEFAULT_VALUE = './'
export const REPO_DEFAULT_VALUE = './'
export const TAB = '\t'
export const CHANGES_MANIFEST_DEFAULT_FILENAME = 'changes.manifest.json'
// Unique internal marker injected when --changes-manifest is passed without a
// value. Replaced with the resolved default path after flag parsing.
export const CHANGES_MANIFEST_BARE_MARKER = '__SGD_CHANGES_MANIFEST_DEFAULT__'
