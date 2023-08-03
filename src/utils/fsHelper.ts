'use strict'
import { readFile as fsReadFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'path'
import { outputFile } from 'fs-extra'
import { spawn } from 'child_process'
import { GIT_PATH_SEP, UTF8_ENCODING } from './gitConstants'
import { EOLRegex, getStreamContent, treatPathSep } from './childProcessUtils'

const FOLDER = 'tree'

const showCmd = ['--no-pager', 'show']
export const gitPathSeparatorNormalizer = (path: string) =>
  path?.replace(/\\+/g, GIT_PATH_SEP)
const copiedFiles = new Set()
const writtenFiles = new Set()

export const copyFiles = async (config, src) => {
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

const readPathFromGitAsBuffer = async (path, { repo, to }) => {
  const normalizedPath = gitPathSeparatorNormalizer(path)
  const bufferData: Buffer = await getStreamContent(
    spawn('git', [...showCmd, `${to}:${normalizedPath}`], {
      cwd: repo,
    })
  )

  return bufferData
}

export const readPathFromGit = async (path, config) => {
  let utf8Data = ''
  try {
    const bufferData = await readPathFromGitAsBuffer(path, config)
    utf8Data = bufferData.toString(UTF8_ENCODING)
  } catch {
    /* empty */
  }
  return utf8Data
}

export const pathExists = async (path, config) => {
  const data = await readPathFromGit(path, config)
  return !!data
}

export const readDir = async (dir, config) => {
  const data = await readPathFromGit(dir, config)
  const dirContent: string[] = []
  if (data.startsWith(FOLDER)) {
    const [, , ...files] = data.split(EOLRegex)
    dirContent.push(...files)
  }
  return dirContent
}

export const readFile = async path => {
  const file = await fsReadFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}

export async function* scan(dir, config) {
  const entries = await readDir(dir, config)
  for (const file of entries) {
    const filePath = join(dir, file)
    if (file.endsWith(GIT_PATH_SEP)) {
      yield* scan(filePath, config)
    } else {
      yield filePath
    }
  }
}

export const writeFile = async (path, content, { output }) => {
  if (writtenFiles.has(path)) return
  writtenFiles.add(path)
  await outputFile(join(output, treatPathSep(path)), content)
}

async function* filterExt(it, ext) {
  for await (const file of it) {
    if (file.endsWith(ext)) {
      yield file
    }
  }
}

export const isSubDir = (parent, dir) => {
  const rel = relative(parent, dir)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

export const scanExtension = (dir, ext, config) =>
  filterExt(scan(dir, config), ext)

export const DOT = '.'
