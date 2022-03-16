'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.errorMode = false
fse.outputFileError = false
fse.pathShouldExist = true

fse.pathExists = jest.fn(() => Promise.resolve(fse.pathShouldExist))
fse.copy = jest.fn(() => {
  if (fse.errorMode) return Promise.reject()
  return Promise.resolve()
})
fse.copySync = jest.fn(() => {
  if (fse.errorMode) throw new Error()
})
fse.outputFile = jest.fn(() =>
  fse.outputFileError ? Promise.reject() : Promise.resolve()
)

module.exports = fse
