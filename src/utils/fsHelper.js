'use strict'
const { readFile: fsReadFile } = require('fs').promises
const { isAbsolute, join, relative } = require('path')
const { outputFile } = require('fs-extra')
const { spawn } = require('child_process')
const { UTF8_ENCODING } = require('../utils/gitConstants')
const { EOLRegex, getStreamContent } = require('./childProcessUtils')

const FOLDER = 'tree'
const FATAL = 'fatal'

const showCmd = ['--no-pager', 'show']
const copiedFiles = new Set()

const copyFiles = async (work, src, dst) => {
  const config = work.config
  if (copiedFiles.has(src)) return
  copiedFiles.add(src)

  src = relative(config.source, src)
  const data = await readPathFromGit(src, config)
  if (!data) {
    return
  }
  if (data.startsWith(FOLDER)) {
    const [header, , ...files] = data.split(EOLRegex)
    const folder = header.split(':')[1]
    for (const file of files) {
      const fileDst = join(config.output, folder, file)
      const fileSrc = join(config.repo, folder, file)

      await copyFiles(work, fileSrc, fileDst)
    }
  } else if (data.startsWith(FATAL)) {
    work.warnings.push(data)
  } else {
    await outputFile(dst, data)
  }
}

const readPathFromGit = async (path, config) => {
  const data = await getStreamContent(
    spawn('git', [...showCmd, `${config.to}:${path}`], {
      cwd: config.repo,
    })
  )

  return data
}

const pathExists = async (path, work) => {
  const data = await readPathFromGit(path, work)
  return data.startsWith(FATAL)
}

const readDir = async (dir, work) => {
  const data = await readPathFromGit(dir, work)
  const dirContent = []
  if (data.startsWith(FOLDER)) {
    const [, , ...files] = data.split(EOLRegex)
    for (const file of files) {
      dirContent.push(join(dir, file))
    }
  }
  return dirContent
}

const readFile = async path => {
  const file = await fsReadFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}

async function* scan(dir, work) {
  const entries = await readDir(dir, work)
  for (const file of entries) {
    if (file.endsWith('/')) {
      yield* scan(file, work)
    } else {
      yield file
    }
  }
}

async function* filterExt(it, ext) {
  for await (const file of it) {
    if (file.endsWith(ext)) {
      yield file
    }
  }
}

const isSubDir = (parent, dir) => {
  const rel = relative(parent, dir)
  return !!rel && !rel.startsWith('..') && !isAbsolute(rel)
}

module.exports.copyFiles = copyFiles
module.exports.isSubDir = isSubDir
module.exports.pathExists = pathExists
module.exports.readDir = readDir
module.exports.readFile = readFile
module.exports.readPathFromGit = readPathFromGit
module.exports.scan = scan
module.exports.scanExtension = (dir, ext, work) =>
  filterExt(scan(dir, work), ext)
