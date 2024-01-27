import ignore, { Ignore } from 'ignore'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
  GIT_DIFF_TYPE_REGEX,
} from '../constant/gitConstants'

import { readFile } from './fsUtils'

// QUESTION: Why we should ignore recordTypes for destructive changes manifest ?
// Because the operation is note enabled on the metadata API https://ideas.salesforce.com/s/idea/a0B8W00000GdeGKUAZ/allow-deletion-of-record-type-using-metadata-api
const BASE_DESTRUCTIVE_IGNORE = ['recordTypes/']

export class IgnoreHelper {
  constructor(
    // eslint-disable-next-line no-unused-vars
    public readonly globalIgnore: Ignore,
    // eslint-disable-next-line no-unused-vars
    protected readonly destructiveIgnore: Ignore
  ) {}

  public keep(line: string): boolean {
    const changeType = line.charAt(0)

    let ignInstance!: Ignore
    if (DELETION === changeType) {
      ignInstance = this.destructiveIgnore
    } else if ([ADDITION, MODIFICATION].includes(changeType)) {
      ignInstance = this.globalIgnore
    }

    const filePath = line.replace(GIT_DIFF_TYPE_REGEX, '')

    return !ignInstance?.ignores(filePath)
  }
}

let ignoreInstance: IgnoreHelper | null
export const buildIgnoreHelper = async ({
  ignore,
  ignoreDestructive,
}: {
  ignore: string
  ignoreDestructive: string
}) => {
  if (!ignoreInstance) {
    const globalIgnore = await _buildIgnore(ignore)
    const destructiveIgnore = await _buildIgnore(ignoreDestructive || ignore)

    destructiveIgnore.add(BASE_DESTRUCTIVE_IGNORE)

    ignoreInstance = new IgnoreHelper(globalIgnore, destructiveIgnore)
  }
  return ignoreInstance
}

let includeInstance: IgnoreHelper | null
export const buildIncludeHelper = async ({
  include,
  includeDestructive,
}: {
  include: string
  includeDestructive: string
}) => {
  if (!includeInstance) {
    const globalIgnore = await _buildIgnore(include)
    const destructiveIgnore = await _buildIgnore(includeDestructive)

    includeInstance = new IgnoreHelper(globalIgnore, destructiveIgnore)
  }
  return includeInstance
}

const _buildIgnore = async (ignorePath: string) => {
  const ign = ignore()
  if (ignorePath) {
    const content = await readFile(ignorePath)
    ign.add(content.toString())
  }
  return ign
}

export const resetIgnoreInstance = () => {
  ignoreInstance = null
}

export const resetIncludeInstance = () => {
  includeInstance = null
}
