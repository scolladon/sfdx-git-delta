'use strict'
import { readFile as fsReadFile } from 'fs-extra'
import { isAbsolute, join, relative } from 'path'
import { outputFile, stat } from 'fs-extra'
import {
  GIT_FOLDER,
  GIT_PATH_SEP,
  UTF8_ENCODING,
} from './gitConstants'
import { EOLRegex, getSpawnContent, treatPathSep } from './childProcessUtils'
import { Config } from '../types/config'

import { lstatSync } from 'fs'

const FOLDER = 'tree'

export const gitPathSeparatorNormalizer = (path: string) =>
  path.replace(/\\+/g, GIT_PATH_SEP)
const copiedFiles = new Set()
const writtenFiles = new Set()

export const copyFiles = async (config: Config, src: string) => {
  if (copiedFiles.has(src) || writtenFiles.has(src)) return
  copiedFiles.add(src)

  try {
    const bufferData: Buffer = await readPathFromGitAsBuffer(src, config)
    const utf8Data = bufferData?.toString(UTF8_ENCODING) ?? ''

    if (utf8Data.startsWith(FOLDER)) {
      const [header, , ...files] = utf8Data.split(EOLRegex)
      const folder = header.split(':')[1]
      for (const file of files) {
        const fileSrc = join(folder, file)

        await copyFiles(config, fileSrc)
      }
    } else {
      const dst = join(config.output, treatPathSep(src))
      // Use Buffer to output the file content
      // Let fs implementation detect the encoding ("utf8" or "binary")
      await outputFile(dst, bufferData)
    }
  } catch {
    /* empty */
  }
}

const isDirectory = async (path: string) => {
  try {
    return lstatSync(path).isDirectory()
  } catch {
    // Path does not exist. Defaulting to false
    return false;
  }
}

const readPathFromGitAsBuffer = async (path: string, { repo, to }: { repo: string; to: string }) => {
  // Custom: "git show HEAD:<FILE>" command was replaced by "cat <FILE>" for better performance.
  to = to
  const normalizedPath = gitPathSeparatorNormalizer(path)

  let command = 'git'
  let args = ['--no-pager', 'show', `${to}:${normalizedPath}`]
  const options = {
    cwd: repo,
  }

  if (to == 'HEAD') {
    command = 'cat'
    args = [`${normalizedPath}`]
  }

  if (await isDirectory(path)) {
    command = 'ls'
    args = [`${normalizedPath}`]
  }

  const bufferData: Buffer = await getSpawnContent(command, args, options)

  return bufferData
}

export const readPathFromGit = async (path: string, config: Config) => {
  let utf8Data = ''
  try {
    const bufferData = await readPathFromGitAsBuffer(path, config)
    utf8Data = bufferData.toString(UTF8_ENCODING)
  } catch (e) {
    /* empty */
  }
  return utf8Data
}

export const pathExists = async (path: string, config: Config) => {
  const data = await readPathFromGit(path, config)
  return !!data
}

export const readDir = async (dir: string, config: Config) => {
  const data = await readPathFromGit(dir, config)
  const dirContent: string[] = []
  if (data.startsWith(FOLDER)) {
    const [, , ...files] = data.split(EOLRegex)
    dirContent.push(...files)
  }
  return dirContent
}

export const readFile = async (path: string) => {
  const file = await fsReadFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}

export async function* scan(
  dir: string,
  config: Config
): AsyncGenerator<string, void, void> {
  const entries = await readDir(dir, config)
  for (const file of entries) {
    const filePath = join(dir, file)
    if (file.endsWith(GIT_PATH_SEP)) {
      yield* scan(filePath, config)
    } else {
      yield filePath
      //yield new Promise<string>(resolve => resolve(filePath))
    }
  }
}

export const writeFile = async (
  path: string,
  content: string,
  { output }: Config
) => {
  if (writtenFiles.has(path)) return
  writtenFiles.add(path)
  await outputFile(join(output, treatPathSep(path)), content)
}

export const isSubDir = (parent: string, dir: string) => {
  const rel = relative(parent, dir)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

export const scanExtension = async (
  dir: string,
  ext: string,
  config: Config
): Promise<string[]> => {
  const result = []
  for await (const file of scan(dir, config)) {
    if (file.endsWith(ext)) {
      result.push(file)
    }
  }
  return result
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

export const isGit = async (dir: string) => {
  const isGitDir = await dirExists(join(dir, GIT_FOLDER))
  const isGitFile = await fileExists(join(dir, GIT_FOLDER))

  return isGitDir || isGitFile
}

export const DOT = '.'
