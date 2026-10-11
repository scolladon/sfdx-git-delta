'use strict'
import { TAB } from '../constant/cliConstants.js'
import { ADDITION, GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants.js'

export const pathOfLine = (line: string): string =>
  line.replace(GIT_DIFF_TYPE_REGEX, '')

export const lineOf = (type: string, path: string): string =>
  `${type}${TAB}${path}`

export const additionLineOf = (path: string): string => lineOf(ADDITION, path)
