'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.errorMode = false
fse.outputFileError = false
fse.pathShouldExist = true

fse.pathExists = () => Promise.resolve(fse.pathShouldExist)
fse.copy = () => (fse.errorMode ? Promise.reject() : Promise.resolve())
fse.copySync = () => {
  if (fse.errorMode) throw new Error()
}
fse.outputFile = () =>
  fse.outputFileError ? Promise.reject() : Promise.resolve()

module.exports = fse
