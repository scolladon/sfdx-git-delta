'use strict'
const { readFile: fsReadFile, readdir } = require('fs').promises
const { isAbsolute, join, relative } = require('path')
const { outputFile } = require('fs-extra')
const { spawn } = require('child_process')
const { UTF8_ENCODING } = require('../utils/gitConstants')
const { EOLRegex, getStreamContent } = require('./childProcessUtils')

const showCmd = ['--no-pager', 'show']

const copiedFiles = new Set()

const copyFiles = async (work, src, dst) => {
  const config = work.config
  if (copiedFiles.has(src)) return
  copiedFiles.add(src)

  src = relative(config.source, src)
  const data = await readFileFromGit(src, config)
  if (!data) {
    return
  }
  // TODO compare previous file system implementation result in term of
  //    - Performance
  //    - Quality of the result
  if (data.startsWith('tree')) {
    const [header, , ...files] = data.split(EOLRegex)
    const folder = header.split(':')[1]
    for (const file of files) {
      const fileDst = join(config.output, folder, file)
      const fileSrc = join(config.repo, folder, file)

      await copyFiles(work, fileSrc, fileDst)
    }
  } else if (data.startsWith('fatal')) {
    work.warnings.push(data)
  } else {
    await outputFile(dst, data)
  }
}

const readFileFromGit = async (path, config) => {
  const data = await getStreamContent(
    spawn('git', [...showCmd, `${config.to}:${path}`], {
      cwd: config.repo,
    })
  )

  return data
}

const readFile = async path => {
  const file = await fsReadFile(path, {
    encoding: UTF8_ENCODING,
  })
  return file
}

async function* scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  for (const de of entries) {
    const res = join(dir, de.name)
    if (de.isDirectory()) {
      yield* scan(res)
    } else {
      yield res
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
module.exports.readFile = readFile
module.exports.readFileFromGit = readFileFromGit
module.exports.scan = scan
module.exports.scanExtension = (dir, ext) => filterExt(scan(dir), ext)
