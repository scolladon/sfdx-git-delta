'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.errorMode = false

fse.copySync = () => {}

fse.outputFileSync = () => {
  if (fse.errorMode) throw new Error()
}

module.exports = fse
