'use strict'
const childProcess = jest.genMockFromModule('child_process')

childProcess.spawnSync = () => ({ stdout: '1stsha' })

module.exports = childProcess
