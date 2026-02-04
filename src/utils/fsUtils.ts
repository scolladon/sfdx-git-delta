import * as fsImpl from 'node:fs/promises'
import { isAbsolute, normalize, relative } from 'node:path/posix'

import {
  PATH_SEP,
  PATH_SEPARATOR_REGEX,
  UTF8_ENCODING,
} from '../constant/fsConstants.js'

export const fs = {
  access: fsImpl.access,
  readFile: fsImpl.readFile,
  stat: fsImpl.stat,
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

export const dirExists = async (dir: string) => {
  try {
    const st = await fs.stat(dir)
    return st.isDirectory()
  } catch {
    return false
  }
}

export const fileExists = async (file: string) => {
  try {
    const st = await fs.stat(file)
    return st.isFile()
  } catch {
    return false
  }
}

export const pathExists = async (path: string) => {
  let pathIsAccessible = true
  try {
    await fs.access(path)
  } catch {
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
