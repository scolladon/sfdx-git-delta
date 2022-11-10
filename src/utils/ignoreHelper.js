const ignore = require('ignore')
const { readFile } = require('../utils/fsHelper')
const {
  ADDITION,
  DELETION,
  MODIFICATION,
  GIT_DIFF_TYPE_REGEX,
} = require('./gitConstants')
class IgnoreHelper {
  globalIgnore
  destructiveIgnore

  constructor(globalIgnore, destructiveIgnore) {
    this.globalIgnore = globalIgnore
    this.destructiveIgnore = destructiveIgnore ?? globalIgnore
  }

  keep(line) {
    const changeType = line.charAt(0)

    let ignInstance = null
    if (DELETION == changeType) {
      ignInstance = this.destructiveIgnore
    } else if ([ADDITION, MODIFICATION].includes(changeType)) {
      ignInstance = this.globalIgnore
    }

    const filePath = line.replace(GIT_DIFF_TYPE_REGEX, '')

    return !ignInstance?.ignores(filePath)
  }
}

const buildIgnoreHelper = async config => {
  const globalIgnore = await forPath(config.ignore)
  const destructiveIgnore = await forPath(config.ignoreDestructive)

  return new IgnoreHelper(globalIgnore, destructiveIgnore)
}

const ignorePerPath = new Map()
const forPath = async ignorePath => {
  let ign = null
  if (ignorePath && !ignorePerPath.has(ignorePath)) {
    ign = ignore()
    const content = await readFile(ignorePath)
    ign.add(content.toString())
    ignorePerPath.set(ignorePath, ign)
  }

  return ignorePerPath.get(ignorePath)
}

module.exports.forPath = forPath
module.exports.buildIgnoreHelper = buildIgnoreHelper
