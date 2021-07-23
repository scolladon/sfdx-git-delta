'use strict'
import { treatDataFromSpawn } from './childProcessUtils'
import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  UTF8_ENCODING,
} from './gitConstants'
import { Config } from '../model/Config'
import { spawnSync, SpawnSyncOptionsWithStringEncoding } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import ignore from 'ignore'
import { EOL } from 'os'
import { sep, parse } from 'path'

const fullDiffParams = ['--no-pager', 'diff', '--name-status', '--no-renames']
const lcSensitivity = {
  sensitivity: 'accent',
}

type LineTypeMap = {
  A: string[]
  D: string[]
}

module.exports = (config: Config, metadata: any) => {
  const { stdout: diff } = spawnSync(
    'git',
    [...fullDiffParams, config.from, config.to, config.source],
    {
      cwd: config.repo,
      encoding: UTF8_ENCODING,
    } as SpawnSyncOptionsWithStringEncoding
  )

  return treatResult(treatDataFromSpawn(diff), metadata, config)
}

const treatResult = (repoDiffResult: string, metadata: any, config: Config) => {
  const lines = repoDiffResult.split(EOL)
  const linesPerDiffType: LineTypeMap = lines.reduce(
    (acc: LineTypeMap, line: string) => (
      acc[line.charAt(0) as keyof LineTypeMap]?.push(line), acc
    ),
    ({ [ADDITION]: [], [DELETION]: [] } as unknown) as LineTypeMap
  )
  const AfileNames = linesPerDiffType[ADDITION as keyof LineTypeMap].map(
    (line: string) => parse(line.replace(GIT_DIFF_TYPE_REGEX, '')).base
  )
  const deletedRenamed = linesPerDiffType[DELETION as keyof LineTypeMap].filter(
    (line: string) => {
      const dEl = parse(line.replace(GIT_DIFF_TYPE_REGEX, '')).base
      return AfileNames.some(
        (aEl: string) => !aEl.localeCompare(dEl, undefined, lcSensitivity)
      )
    }
  )

  return lines
    .filter(
      (line: string) =>
        !!line &&
        !deletedRenamed.includes(line) &&
        line
          .split(sep)
          .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
    )
    .filter(filterIgnore(config))
}

const filterIgnore = (config: Config) => (line: string) => {
  const ig = ignore()
  const dig = ignore()
  ;[
    { ignore: config.ignore, helper: ig },
    { ignore: config.ignoreDestructive, helper: dig },
  ].forEach(
    ign =>
      ign.ignore &&
      existsSync(ign.ignore) &&
      ign.helper.add(readFileSync(ign.ignore).toString())
  )
  return config.ignoreDestructive
    ? line.startsWith(DELETION)
      ? !dig.ignores(line.replace(GIT_DIFF_TYPE_REGEX, ''))
      : !ig.ignores(line.replace(GIT_DIFF_TYPE_REGEX, ''))
    : !ig.ignores(line.replace(GIT_DIFF_TYPE_REGEX, ''))
}
