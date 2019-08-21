'use strict'
const path = require('path')
const fs = jest.genMockFromModule('fs')

let errorMode = false
let mockFiles = {}
let filePathList = new Set()
fs.__setMockFiles = newMockFiles => {
  mockFiles = {}
  filePathList = new Set()
  for (const file in newMockFiles) {
    filePathList.add(file)
    const dir = path.dirname(file)

    if (!mockFiles[dir]) {
      mockFiles[dir] = mockFiles[dir] || []
    }
    mockFiles[dir].push(path.basename(file))
  }
}

fs.readdirSync = directoryPath => {
  if (directoryPath.endsWith('metadata')) {
    return ['v46.json']
  }
  return mockFiles[directoryPath] || []
}

fs.existsSync = filePath => filePathList.has(filePath)

fs.writeFile = (_filePath, _content, _encoding, cb) =>
  errorMode ? cb(new Error()) : cb(null)

module.exports = fs
