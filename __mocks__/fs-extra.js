'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.errorMode = false
fse.outputFileSyncError = false

fse.pathExistsSync = () => true

fse.copySync = () => {
  if (fse.errorMode) throw new Error()
}

fse.outputFileSync = () => {
  if (fse.outputFileSyncError) throw new Error()
}

module.exports = fse
