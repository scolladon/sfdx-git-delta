'use strict'
const { EventEmitter, Readable } = require('stream')
const { EOL } = require('os')
const childProcess = jest.genMockFromModule('child_process')

let output = []

childProcess.__setOutput = value => (output = value)

childProcess.spawn.mockImplementation(() => {
  const mock = new EventEmitter()
  mock.stdout = new Readable({
    read() {
      this.push(output.pop().join(EOL))
      this.push(null)
      mock.emit('close')
    },
  })
  return mock
})

module.exports = childProcess
