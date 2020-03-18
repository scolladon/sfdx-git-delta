'use strict'
const path = require('path')
const fs = jest.genMockFromModule('fs')

let errorMode = false
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
    mockFiles[dir] = mockFiles[dir] || []
    mockFiles[dir].push(path.basename(file))
    mockContent[file] = newMockFiles[file]
  }
}

fs.readdirSync = directoryPath => {
  if (directoryPath.endsWith('metadata')) {
    return ['v48.json']
  }
  return mockFiles[path.basename(directoryPath)] || []
}

fs.existsSync = filePath => {
  return filePathList.has(path.basename(filePath))
}

fs.statSync = elem => ({
  isDirectory() {
    return elem !== 'file'
  },
})

fs.readFileSync = path =>
  Object.prototype.hasOwnProperty.call(mockContent, path)
    ? mockContent[path]
    : '<type>MasterDetail</type>'

fs.writeFile = (_filePath, _content, _encoding, cb) =>
  errorMode ? cb(new Error()) : cb(null)

module.exports = fs
