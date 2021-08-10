'use strict'
import { EOL } from 'os'
import { sep, normalize } from 'path'

const treatEOL = (data: string): string => data.replace(/\r?\n/g, EOL)
const treatPathSep = (data: string): string => data.replace(/[/\\]+/g, sep)
const sanitizePath = (data: string): string =>
  data !== null && data !== undefined ? normalize(treatPathSep(data)) : data
const treatDataFromSpawn = (data: string): string =>
  treatEOL(treatPathSep(data))

export { treatDataFromSpawn, treatEOL, sanitizePath }
