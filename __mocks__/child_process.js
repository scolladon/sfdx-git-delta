'use strict'
const { EventEmitter, Readable } = require('stream')
const { EOL } = require('os')
const childProcess = jest.genMockFromModule('child_process')

let output = []
let error = false

childProcess.__setOutput = value => (output = value)
childProcess.__setError = value => (error = value)

childProcess.spawn.mockImplementation(() => {
  const mock = new EventEmitter()
  mock.stdout = new Readable({
    read() {
      if (!error && output.length) {
        this.push(output.pop().join(EOL))
      }
      this.push(null)
      mock.emit('close')
    },
  })
  mock.stderr = new Readable({
    read() {
      if (error) {
        this.push('error')
      }
      this.push(null)
      mock.emit('close')
    },
  })
  return mock
})

module.exports = childProcess
