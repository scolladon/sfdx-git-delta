'use strict'
const { readdir } = require('fs').promises
const { join } = require('path')

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

module.exports.scan = scan
module.exports.scanExtension = (dir, ext) => filterExt(scan(dir), ext)
