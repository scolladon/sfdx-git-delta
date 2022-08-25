'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.errorMode = false
fse.outputFileError = false
fse.pathShouldExist = true

fse.pathExists.mockImplementation(() => Promise.resolve(fse.pathShouldExist))
fse.copy.mockImplementation(() => {
  if (fse.errorMode) return Promise.reject()
  return Promise.resolve()
})
fse.copySync.mockImplementation(() => {
  if (fse.errorMode) throw new Error()
})
fse.outputFile.mockImplementation(() =>
  fse.outputFileError ? Promise.reject() : Promise.resolve()
)

module.exports = fse
