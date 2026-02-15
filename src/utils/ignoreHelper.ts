import ignore, { Ignore } from 'ignore'

import {
  ADDITION,
  DELETION,
  GIT_DIFF_TYPE_REGEX,
  MODIFICATION,
} from '../constant/gitConstants.js'
import { readFile } from './fsUtils.js'
import { log } from './LoggingDecorator.js'

// RATIONALE: Why are recordTypes excluded from destructive changes?
// The Metadata API does not support deleting RecordType via destructiveChanges.xml.
// See: https://github.com/scolladon/sfdx-git-delta/wiki/Metadata-Specificities#recordtype-destructive-changes
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
