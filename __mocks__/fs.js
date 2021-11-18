'use strict'
const path = require('path')
const fs = jest.genMockFromModule('fs')

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

fs.readdirSync = directoryPath => mockFiles[path.basename(directoryPath)] ?? []

fs.existsSync = filePath => filePathList.has(path.basename(filePath))

fs.statSync = elem => ({
  isDirectory() {
    return elem !== 'file'
  },
  isFile() {
    return filePathList.has(elem)
  },
})

fs.readFileSync = path => {
  if (fs.errorMode) throw new Error()
  return Object.prototype.hasOwnProperty.call(mockContent, path)
    ? mockContent[path]
    : '<type>MasterDetail</type>'
}

fs.writeFileSync = () => {
  if (fs.errorMode) throw new Error()
}

module.exports = fs
