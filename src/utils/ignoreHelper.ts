import ignore, { Ignore } from 'ignore'
import { readFile } from './fsHelper'
import {
  ADDITION,
  DELETION,
  MODIFICATION,
  GIT_DIFF_TYPE_REGEX,
} from './gitConstants'

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

    let ignInstance!: Ignore
    if (DELETION == changeType) {
      ignInstance = this.destructiveIgnore
    } else if ([ADDITION, MODIFICATION].includes(changeType)) {
      ignInstance = this.globalIgnore
    }

    const filePath = line.replace(GIT_DIFF_TYPE_REGEX, '')

    return !ignInstance?.ignores(filePath)
  }
}

let ignoreInstance
export const buildIgnoreHelper = async ({ ignore, ignoreDestructive }) => {
  if (!ignoreInstance) {
    const globalIgnore = await _buildIgnore(ignore)
    const destructiveIgnore = ignoreDestructive
      ? await _buildIgnore(ignoreDestructive)
      : await _buildIgnore(ignore)

    await _addDefaultDestructiveIgnore(destructiveIgnore)

    ignoreInstance = new IgnoreHelper(globalIgnore, destructiveIgnore)
  }
  return ignoreInstance
}

let includeInstance
export const buildIncludeHelper = async ({ include, includeDestructive }) => {
  if (!includeInstance) {
    const globalIgnore = await _buildIgnore(include)
    const destructiveIgnore = await _buildIgnore(includeDestructive)

    includeInstance = new IgnoreHelper(globalIgnore, destructiveIgnore)
  }
  return includeInstance
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

export const resetIgnoreInstance = () => {
  ignoreInstance = null
}

export const resetIncludeInstance = () => {
  includeInstance = null
}
