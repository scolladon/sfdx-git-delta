import ignore, { Ignore } from 'ignore'

import { DELETION, GIT_DIFF_TYPE_REGEX } from '../constant/gitConstants'

import { readFile } from './fsUtils'

// QUESTION: Why we should ignore recordTypes for destructive changes manifest ?
// Because the operation is note enabled on the metadata API https://ideas.salesforce.com/s/idea/a0B8W00000GdeGKUAZ/allow-deletion-of-record-type-using-metadata-api
const BASE_DESTRUCTIVE_IGNORE = ['recordTypes/']

export class IgnoreHelper {
  private static ignoreInstance: IgnoreHelper | null
  private static includeInstance: IgnoreHelper | null

  public static async getIgnoreInstance({
    ignore,
    ignoreDestructive,
  }: {
    ignore: string
    ignoreDestructive: string
  }) {
    if (!IgnoreHelper.ignoreInstance) {
      const globalIgnore = await _buildIgnore(ignore)
      const destructiveIgnore = await _buildIgnore(ignoreDestructive || ignore)

      destructiveIgnore.add(BASE_DESTRUCTIVE_IGNORE)

      IgnoreHelper.ignoreInstance = new IgnoreHelper(
        globalIgnore,
        destructiveIgnore
      )
    }
    return IgnoreHelper.ignoreInstance
  }

  public static async getIncludeInstance({
    include,
    includeDestructive,
  }: {
    include: string
    includeDestructive: string
  }) {
    if (!IgnoreHelper.includeInstance) {
      const globalInclude = await _buildIgnore(include)
      const destructiveInclude = await _buildIgnore(includeDestructive)

      IgnoreHelper.includeInstance = new IgnoreHelper(
        globalInclude,
        destructiveInclude
      )
    }
    return IgnoreHelper.includeInstance
  }

  private constructor(
    // eslint-disable-next-line no-unused-vars
    protected readonly globalIgnore: Ignore,
    // eslint-disable-next-line no-unused-vars
    protected readonly destructiveIgnore: Ignore
  ) {}

  public keep(line: string): boolean {
    const changeType = line.charAt(0)

    const ignInstance: Ignore =
      DELETION === changeType ? this.destructiveIgnore : this.globalIgnore

    const filePath = line.replace(GIT_DIFF_TYPE_REGEX, '')

    return !ignInstance?.ignores(filePath)
  }

  public static resetForTest() {
    IgnoreHelper.includeInstance = null
    IgnoreHelper.ignoreInstance = null
  }
}

const _buildIgnore = async (ignorePath: string) => {
  const ign = ignore()
  if (ignorePath) {
    const content = await readFile(ignorePath)
    ign.add(content.toString())
  }
  return ign
}
