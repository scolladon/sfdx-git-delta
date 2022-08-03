'use strict'
const { copyFile, readFile: fsReadFile, readdir } = require('fs').promises
const { join } = require('path')
const { copy, copySync, pathExists } = require('fs-extra')
const { UTF8_ENCODING } = require('../utils/gitConstants')

const FSE_BIGINT_ERROR = 'Source and destination must not be the same.'
const FSE_COPYSYNC_OPTION = {
  overwrite: true,
  errorOnExist: false,
  dereference: true,
  preserveTimestamps: false,
}

const copiedFiles = new Set()

const copyFiles = async (src, dst) => {
  if (copiedFiles.has(src)) return
  const exists = await pathExists(src)
  if (!copiedFiles.has(src) && exists) {
    copiedFiles.add(src)
    try {
      await copy(src, dst, FSE_COPYSYNC_OPTION)
    } catch (error) {
      if (error.message === FSE_BIGINT_ERROR) {
        // Handle this fse issue manually (https://github.com/jprichardson/node-fs-extra/issues/657)
        await copyFile(src, dst)
      } else {
        // Retry sync in case of async error
        copySync(src, dst, FSE_COPYSYNC_OPTION)
      }
    }
  }
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

module.exports.copyFiles = copyFiles
module.exports.readFile = readFile
module.exports.scan = scan
module.exports.scanExtension = (dir, ext) => filterExt(scan(dir), ext)
module.exports.FSE_BIGINT_ERROR = FSE_BIGINT_ERROR
