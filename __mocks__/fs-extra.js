'use strict'
const fse = jest.genMockFromModule('fs-extra')

fse.copy = () => new Promise(resolve => resolve())

module.exports = fse
