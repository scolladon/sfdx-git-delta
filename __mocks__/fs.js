'use strict'
const path = require('path')
const fs = jest.createMockFromModule('fs')
const { MASTER_DETAIL_TAG } = require('../src/utils/metadataConstants')

fs.errorMode = false
fs.statErrorMode = false
let mockFiles = new Map()
let mockContent = new Map()
let filePathList = new Set()
fs.__setMockFiles = newMockFiles => {
  mockFiles = new Map()
  mockContent = new Map()
  filePathList = new Set()
  for (const file in newMockFiles) {
    filePathList.add(file)
    const dir = path.basename(path.dirname(file))
    if (!mockFiles.has(dir)) {
      mockFiles.set(dir, [])
    }
    mockFiles.get(dir).push(path.basename(file))
    mockContent.set(file, newMockFiles[file])
  }
}

Object.defineProperty(fs, 'promises', {
  value: {},
})

fs.promises.stat = jest.fn(
  elem =>
    new Promise((res, rej) => {
      if (fs.statErrorMode) rej(new Error())
      else
        res({
          isDirectory() {
            return filePathList.has(elem)
          },
          isFile() {
            return filePathList.has(elem)
          },
        })
    })
)

fs.promises.readFile = jest.fn(
  path =>
    new Promise((res, rej) => {
      if (fs.errorMode) rej(new Error())
      else {
        const result = mockContent.has(path)
          ? mockContent.get(path)
          : MASTER_DETAIL_TAG
        res(result)
      }
    })
)

fs.promises.readdir = jest.fn(
  (directoryPath, config) =>
    new Promise(res => {
      let result = mockFiles.get(path.basename(directoryPath)) ?? []
      if (config) {
        result = result.map(filePath => ({
          name: filePath,
          isDirectory: () => false,
        }))
      }
      res(result)
    })
)

fs.promises.copyFile = jest.fn(() =>
  jest.fn(() => {
    if (fs.errorMode) return Promise.reject()
    return Promise.resolve()
  })
)

module.exports = fs
