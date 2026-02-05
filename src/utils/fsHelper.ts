'use strict'
import { join } from 'node:path/posix'

import { outputFile } from 'fs-extra'

import GitAdapter from '../adapter/GitAdapter.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'

import { getErrorMessage } from './errorUtils.js'
import { buildIgnoreHelper } from './ignoreHelper.js'
import { Logger, lazy } from './LoggingService.js'

const copiedFiles = new Set()
const writtenFiles = new Set()

export const copyFiles = async (config: Config, src: string) => {
  if (copiedFiles.has(src) || writtenFiles.has(src)) {
    return
  }
  copiedFiles.add(src)

  const ignoreHelper = await buildIgnoreHelper(config)
  if (ignoreHelper.globalIgnore.ignores(src)) {
    return
  }
  try {
    const gitAdapter = GitAdapter.getInstance(config)
    for await (const file of gitAdapter.getFilesFrom(src)) {
      // Use Buffer to output the file content
      // Let fs implementation detect the encoding ("utf8" or "binary")
      const dst = join(config.output, file.path)
      await outputFile(dst, file.content)
      copiedFiles.add(dst)
    }
  } catch (error) {
    Logger.debug(lazy`copyFiles failed for ${src}: ${getErrorMessage(error)}`)
  }
}

export const readPathFromGit = async (forRef: FileGitRef, config: Config) => {
  let utf8Data = ''
  try {
    const gitAdapter = GitAdapter.getInstance(config)
    utf8Data = await gitAdapter.getStringContent(forRef)
  } catch (error) {
    Logger.debug(
      lazy`readPathFromGit failed for ${forRef.path}: ${getErrorMessage(error)}`
    )
  }
  return utf8Data
}

export const pathExists = async (path: string, config: Config) => {
  const gitAdapter = GitAdapter.getInstance(config)
  return await gitAdapter.pathExists(path)
}

export const readDirs = async (
  paths: string | string[],
  config: Config
): Promise<string[]> => {
  const gitAdapter = GitAdapter.getInstance(config)
  return await gitAdapter.getFilesPath(paths)
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

  const ignoreHelper = await buildIgnoreHelper(config)
  if (ignoreHelper.globalIgnore.ignores(path)) {
    return
  }
  await outputFile(join(config.output, path), content)
}
