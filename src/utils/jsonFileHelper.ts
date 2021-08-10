import { UTF8_ENCODING } from './gitConstants'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const readFileSyncOptions = {
  encoding: UTF8_ENCODING,
}

export const parseFile = (...filepath: Array<string>): any =>
  JSON.parse(readFileSync(resolve(...filepath), readFileSyncOptions))
