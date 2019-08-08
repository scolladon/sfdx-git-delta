'use strict'
const fse = jest.genMockFromModule('fs-extra')

// eslint-disable-next-line no-unused-vars
fse.copy = (_src, _tgt) => new Promise(resolve => resolve())

module.exports = fse
