import * as fsImpl from 'node:fs/promises'
import { isAbsolute, normalize, relative } from 'node:path/posix'

import {
  PATH_SEP,
  PATH_SEPARATOR_REGEX,
  UTF8_ENCODING,
} from '../constant/fsConstants.js'
import { getErrorMessage } from './errorUtils.js'
import { Logger, lazy } from './LoggingService.js'

export const fs = {
  access: fsImpl.access,
  readFile: fsImpl.readFile,
}

export const treatPathSep = (data: string) =>
  data.replace(PATH_SEPARATOR_REGEX, PATH_SEP)

export const sanitizePath = (data: string | undefined) =>
  data ? normalize(treatPathSep(data)) : data

export const isSubDir = (parent: string, dir: string) => {
  const rel = relative(parent, dir)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

export const isSamePath = (pathA: string, pathB: string) =>
  !relative(pathA, pathB)

export const pathExists = async (path: string) => {
  let pathIsAccessible = true
  try {
    await fs.access(path)
  } catch (error) {
    Logger.debug(
      lazy`pathExists: '${path}' not accessible: ${() => getErrorMessage(error)}`
    )
    pathIsAccessible = false
  }
  return pathIsAccessible
}

export const readFile = async (path: string) => {
  const file = await fs.readFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}
