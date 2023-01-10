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

const copyFiles = async (config, src, dst) => {
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

      await copyFiles(config, fileSrc, fileDst)
    }
  } else if (data.startsWith(FATAL)) {
    throw new Error(data)
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

const pathExists = async (path, config) => {
  const data = await readPathFromGit(path, config)
  return data.startsWith(FATAL)
}

const readDir = async (dir, config) => {
  const data = await readPathFromGit(dir, config)
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

async function* scan(dir, config) {
  const entries = await readDir(dir, config)
  for (const file of entries) {
    if (file.endsWith('/')) {
      yield* scan(file, config)
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
module.exports.scanExtension = (dir, ext, config) =>
  filterExt(scan(dir, config), ext)
