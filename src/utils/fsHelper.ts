'use strict'
import { join } from 'node:path/posix'

import { outputFile } from 'fs-extra'

import GitAdapter from '../adapter/GitAdapter.js'
import type { Config } from '../types/config.js'
import type { FileGitRef } from '../types/git.js'

import { getErrorMessage } from './errorUtils.js'
import { buildIgnoreHelper } from './ignoreHelper.js'
import { Logger, lazy } from './LoggingService.js'

const writtenFiles = new Set()

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

export const grepContent = async (
  pattern: string,
  path: string,
  config: Config
): Promise<string[]> => {
  const gitAdapter = GitAdapter.getInstance(config)
  return await gitAdapter.gitGrep(pattern, path)
}

export const contentIncludes = async (
  pattern: string,
  path: string,
  config: Config
): Promise<boolean> => {
  const results = await grepContent(pattern, path, config)
  return results.length > 0
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
