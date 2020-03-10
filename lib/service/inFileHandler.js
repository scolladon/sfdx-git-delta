'use strict'
const StandardHandler = require('./standardHandler')
class InFileHandler extends StandardHandler {
  handleDeletion() {
    super.handleDeletion()
  }

  handleAddition() {
    super.handleAddition()
  }
}

module.exports = InFileHandler
