'use strict'
const cpUtils = require('./childProcessUtils')
const gc = require('./gitConstants')
const childProcess = require('child_process')
const fs = require('fs')
const ignore = require('ignore')
const os = require('os')
const path = require('path')

const fullDiffParams = ['--no-pager', 'diff', '--name-status', '--no-renames']
const ig = ignore()

module.exports = (config, metadata) => {
  const { stdout: diff } = childProcess.spawnSync(
    'git',
    [...fullDiffParams, config.from, config.to],
    { cwd: config.repo, encoding: gc.UTF8_ENCODING }
  )

  if (config.ignore && fs.existsSync(config.ignore)) {
    ig.add(fs.readFileSync(config.ignore).toString())
  }

  return treatResult(cpUtils.treatDataFromSpawn(diff), metadata)
}

const treatResult = (repoDiffResult, metadata) => {
  const lines = repoDiffResult.split(os.EOL),
    AD = {
      A: [],
      D: [],
    }

  lines.forEach(line => AD[line.charAt(0)]?.push(line))

  const AfileName = new Set(
      AD.A.map(
        line => path.parse(line.replace(gc.GIT_DIFF_TYPE_REGEX, '')).base
      )
    ),
    moved = new Set(
      AD.D.filter(line =>
        AfileName.has(path.parse(line.replace(gc.GIT_DIFF_TYPE_REGEX, '')).base)
      )
    )

  return lines.filter(
    line =>
      !!line &&
      !moved.has(line) &&
      !ig.ignores(line.replace(gc.GIT_DIFF_TYPE_REGEX, '')) &&
      line
        .split(path.sep)
        .some(part => Object.prototype.hasOwnProperty.call(metadata, part))
  )
}
