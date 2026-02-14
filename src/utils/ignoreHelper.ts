import ignore, { Ignore } from 'ignore'

import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} from '../constant/gitConstants.js'
import { readFile } from './fsUtils.js'
import { log } from './LoggingDecorator.js'

// QUESTION: Why we should ignore recordTypes for destructive changes manifest ?
// Because the operation is note enabled on the metadata API https://ideas.salesforce.com/s/idea/a0B8W00000GdeGKUAZ/allow-deletion-of-record-type-using-metadata-api
const BASE_DESTRUCTIVE_IGNORE = ['recordTypes/']

export class IgnoreHelper {
  private static ignoreInstance: IgnoreHelper | null = null
  private static includeInstance: IgnoreHelper | null = null

  constructor(
    public readonly globalIgnore: Ignore,
    protected readonly destructiveIgnore: Ignore
  ) {}

  @log
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

  static resetIgnoreInstance() {
    IgnoreHelper.ignoreInstance = null
  }

  static resetIncludeInstance() {
    IgnoreHelper.includeInstance = null
  }
}

export const buildIgnoreHelper = async ({
  ignore: ignorePath,
  ignoreDestructive,
}: {
  ignore?: string | undefined
  ignoreDestructive?: string | undefined
}) => {
  if (!IgnoreHelper['ignoreInstance']) {
    const globalIgnore = await _buildIgnore(ignorePath)
    const destructiveIgnore = await _buildIgnore(
      ignoreDestructive || ignorePath
    )

    destructiveIgnore.add(BASE_DESTRUCTIVE_IGNORE)

    IgnoreHelper['ignoreInstance'] = new IgnoreHelper(
      globalIgnore,
      destructiveIgnore
    )
  }
  return IgnoreHelper['ignoreInstance']
}

export const buildIncludeHelper = async ({
  include,
  includeDestructive,
}: {
  include?: string | undefined
  includeDestructive?: string | undefined
}) => {
  if (!IgnoreHelper['includeInstance']) {
    const globalIgnore = await _buildIgnore(include)
    const destructiveIgnore = await _buildIgnore(includeDestructive)

    IgnoreHelper['includeInstance'] = new IgnoreHelper(
      globalIgnore,
      destructiveIgnore
    )
  }
  return IgnoreHelper['includeInstance']
}

const _buildIgnore = async (ignorePath: string | undefined) => {
  const ign = ignore()
  if (ignorePath) {
    const content = await readFile(ignorePath)
    ign.add(content.toString())
  }
  return ign
}
