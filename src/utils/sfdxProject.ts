'use strict'
import { posix } from 'node:path'

import { z } from 'zod'

import type GitAdapter from '../adapter/GitAdapter.js'
import { getErrorMessage, SgdError } from './errorUtils.js'

export const SFDX_PROJECT_FILE = 'sfdx-project.json'

export type RootFileReader = Pick<GitAdapter, 'getRootFileContent'>

// null: outside every entry. '': the root entry, which contains every path.
export type PackageDirectoryKey = string | null

const ROOT_DIRECTORY = ''
const CURRENT_DIRECTORY = '.'
const LEADING_CURRENT = /^\.\//
const TRAILING_SLASH = /\/+$/

export class SfdxProjectError extends SgdError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SfdxProjectError'
  }
}

export const normalisePackageDirectory = (raw: string): string => {
  const normalised = posix
    .normalize(raw.replaceAll('\\', '/'))
    .replace(LEADING_CURRENT, '')
    .replace(TRAILING_SLASH, '')
  return normalised === CURRENT_DIRECTORY ? ROOT_DIRECTORY : normalised
}

const projectSchema = z.looseObject({
  packageDirectories: z.array(z.looseObject({ path: z.string() })).optional(),
  sourceApiVersion: z.unknown().optional(),
})

const isInside = (entry: string, path: string): boolean =>
  entry === ROOT_DIRECTORY || path === entry || path.startsWith(`${entry}/`)

export class SfdxProject {
  static readonly ABSENT = new SfdxProject([], undefined)

  readonly #entries: readonly string[]

  private constructor(
    entries: readonly string[],
    readonly sourceApiVersion: unknown
  ) {
    this.#entries = [...new Set(entries)].sort((a, b) => b.length - a.length)
  }

  static parse(json: string): SfdxProject {
    try {
      const contents = projectSchema.parse(JSON.parse(json))
      const entries = (contents.packageDirectories ?? []).map(directory =>
        normalisePackageDirectory(directory.path)
      )
      return new SfdxProject(entries, contents.sourceApiVersion)
    } catch (error) {
      throw new SfdxProjectError(
        `Invalid ${SFDX_PROJECT_FILE}: ${getErrorMessage(error)}`,
        { cause: error }
      )
    }
  }

  packageDirectoryOf(path: string): PackageDirectoryKey {
    return this.#entries.find(entry => isInside(entry, path)) ?? null
  }
}

export const loadSfdxProject = async (
  reader: RootFileReader,
  revision: string
): Promise<SfdxProject> => {
  const content = await reader.getRootFileContent(revision, SFDX_PROJECT_FILE)
  return content === undefined ? SfdxProject.ABSENT : SfdxProject.parse(content)
}
