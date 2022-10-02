const ignore = require('ignore')
const { readFile } = require('../utils/fsHelper')

class IgnoreHelper {
  static ignorePerPath = new Map()

  async forPath(ignorePath) {
    if (!IgnoreHelper.ignorePerPath.has(ignorePath)) {
      const ign = ignore()
      const content = await readFile(ignorePath)
      ign.add(content.toString())
      IgnoreHelper.ignorePerPath.set(ignorePath, ign)
    }

    return IgnoreHelper.ignorePerPath.get(ignorePath)
  }
}

module.exports = IgnoreHelper
