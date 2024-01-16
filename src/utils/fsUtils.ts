'use strict'
import { stat, readFile as fsReadFile } from 'fs-extra'
import { isAbsolute, relative } from 'path'
import { UTF8_ENCODING } from '../constant/fsConstants'

export const isSubDir = (parent: string, dir: string) => {
  const rel = relative(parent, dir)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

export const dirExists = async (dir: string) => {
  try {
    const st = await stat(dir)
    return st.isDirectory()
  } catch {
    return false
  }
}

export const fileExists = async (file: string) => {
  try {
    const st = await stat(file)
    return st.isFile()
  } catch {
    return false
  }
}

export const readFile = async (path: string) => {
  const file = await fsReadFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}
