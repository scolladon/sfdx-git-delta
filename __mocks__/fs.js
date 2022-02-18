'use strict'
const path = require('path')
const fs = jest.genMockFromModule('fs')
const { MASTER_DETAIL_TAG } = require('../src/utils/metadataConstants')

fs.errorMode = false
let mockFiles = {}
let mockContent = {}
let filePathList = new Set()
fs.__setMockFiles = newMockFiles => {
  mockFiles = {}
  mockContent = {}
  filePathList = new Set()
  for (const file in newMockFiles) {
    filePathList.add(path.basename(file))
    const dir = path.basename(path.dirname(file))
    mockFiles[dir] = mockFiles[dir] ?? []
    mockFiles[dir].push(path.basename(file))
    mockContent[file] = newMockFiles[file]
  }
}

fs.promises = {}

fs.promises.stat = elem =>
  Promise.resolve({
    isDirectory() {
      return elem !== 'file'
    },
    isFile() {
      return filePathList.has(elem)
    },
  })

fs.promises.readFile = path =>
  new Promise((res, rej) => {
    if (fs.errorMode) rej(new Error())
    else {
      const result = Object.prototype.hasOwnProperty.call(mockContent, path)
        ? mockContent[path]
        : MASTER_DETAIL_TAG
      res(result)
    }
  })

fs.promises.readdir = directoryPath =>
  new Promise(res => {
    const result = mockFiles[path.basename(directoryPath)] ?? []
    res(result)
  })

module.exports = fs
