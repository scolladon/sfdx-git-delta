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

export const getDiff = (config: Config, metadata: any): string[] => {
  const { stdout: diff } = spawnSync(
    'git',
    [...fullDiffParams, config.from, config.to, config.source],
    <SpawnSyncOptionsWithStringEncoding>{
      cwd: config.repo,
      encoding: UTF8_ENCODING,
    }
  )

  return treatResult(treatDataFromSpawn(diff), metadata, config)
}

const treatResult = (
  repoDiffResult: string,
  metadata: any,
  config: Config
): string[] => {
  const lines = repoDiffResult.split(EOL)
  const linesPerDiffType: LineTypeMap = lines.reduce(
    (acc: LineTypeMap, line: string): LineTypeMap => (
      acc[line.charAt(0) as keyof LineTypeMap]?.push(line), acc
    ),
    <LineTypeMap>(<unknown>{ [ADDITION]: [], [DELETION]: [] })
  )
  const AfileNames = linesPerDiffType[ADDITION as keyof LineTypeMap].map(
    (line: string): string => parse(line.replace(GIT_DIFF_TYPE_REGEX, '')).base
  )
  const deletedRenamed = linesPerDiffType[DELETION as keyof LineTypeMap].filter(
    (line: string): boolean => {
      const dEl = parse(line.replace(GIT_DIFF_TYPE_REGEX, '')).base
      return AfileNames.some(
        (aEl: string): boolean =>
          !aEl.localeCompare(dEl, undefined, lcSensitivity)
      )
    }
  )

  return lines
    .filter(
      (line: string): boolean =>
        !!line &&
        !deletedRenamed.includes(line) &&
        line
          .split(sep)
          .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
    )
    .filter(filterIgnore(config))
}

const filterIgnore = (config: Config) => (line: string): boolean => {
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
