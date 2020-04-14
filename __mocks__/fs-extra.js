'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.errorMode = false

fse.copy = () => new Promise(resolve => resolve())

fse.outputFileSync = () => {
  if (fse.errorMode) throw new Error()
}

module.exports = fse
