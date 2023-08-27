const ignore = require('ignore')
const { readFile } = require('../utils/fsHelper')
const {
  ADDITION,
  DELETION,
  MODIFICATION,
  GIT_DIFF_TYPE_REGEX,
} = require('./gitConstants')

const BASE_DESTRUCTIVE_IGNORE = ['recordTypes/']

class IgnoreHelper {
  globalIgnore
  destructiveIgnore

  constructor(globalIgnore, destructiveIgnore) {
    this.globalIgnore = globalIgnore
    this.destructiveIgnore = destructiveIgnore
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

let instance
const buildIgnoreHelper = async ({ ignore, ignoreDestructive }) => {
  if (!instance) {
    const globalIgnore = await _buildIgnore(ignore)
    let destructiveIgnore = ignoreDestructive
      ? await _buildIgnore(ignoreDestructive)
      : await _buildIgnore(ignore)

    await _addDefaultDestructiveIgnore(destructiveIgnore)

    instance = new IgnoreHelper(globalIgnore, destructiveIgnore)
  }
  return instance
}

const _buildIgnore = async ignorePath => {
  const ign = ignore()
  if (ignorePath) {
    const content = await readFile(ignorePath)
    ign.add(content.toString())
  }
  return ign
}

const _addDefaultDestructiveIgnore = async destructiveIgnore => {
  destructiveIgnore.add(BASE_DESTRUCTIVE_IGNORE)
}

const resetInstance = () => {
  instance = null
}

module.exports.buildIgnoreHelper = buildIgnoreHelper
module.exports.resetInstance = resetInstance
