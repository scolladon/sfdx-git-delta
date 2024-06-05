'use strict'
import { join } from 'path'

import { outputFile } from 'fs-extra'

import GitAdapter from '../adapter/GitAdapter'
import type { Config } from '../types/config'
import type { FileGitRef } from '../types/git'

import { treatPathSep } from './fsUtils'
import { IgnoreHelper } from './ignoreHelper'

const copiedFiles = new Set()
const writtenFiles = new Set()

export const copyFiles = async (config: Config, src: string) => {
  if (copiedFiles.has(src) || writtenFiles.has(src)) {
    return
  }
  copiedFiles.add(src)

  const ignoreHelper = await IgnoreHelper.getIgnoreInstance(config)
  if (!ignoreHelper.keep(src)) {
    return
  }
  try {
    const gitAdapter = GitAdapter.getInstance(config)
    const files = await gitAdapter.getFilesFrom(treatPathSep(src))
    for (const file of files) {
      // Use Buffer to output the file content
      // Let fs implementation detect the encoding ("utf8" or "binary")
      const dst = join(config.output, file.path)
      await outputFile(treatPathSep(dst), file.content)
      copiedFiles.add(dst)
    }
  } catch {
    /* empty */
  }
}

export const readPathFromGit = async (forRef: FileGitRef, config: Config) => {
  let utf8Data = ''
  try {
    const gitAdapter = GitAdapter.getInstance(config)
    utf8Data = await gitAdapter.getStringContent(forRef)
  } catch (error) {
    /* empty */
  }
  return utf8Data
}

export const pathExists = async (path: string, config: Config) => {
  const gitAdapter = GitAdapter.getInstance(config)
  try {
    return await gitAdapter.pathExists(path)
  } catch {
    return false
  }
}

export const readDir = async (
  path: string,
  config: Config
): Promise<string[]> => {
  const gitAdapter = GitAdapter.getInstance(config)
  return await gitAdapter.getFilesPath(path)
}

export const writeFile = async (
  path: string,
  content: string,
  config: Config
) => {
  if (writtenFiles.has(path)) {
    return
  }
  writtenFiles.add(path)

  const ignoreHelper = await IgnoreHelper.getIgnoreInstance(config)
  if (!ignoreHelper.keep(path)) {
    return
  }
  await outputFile(join(config.output, treatPathSep(path)), content)
}
