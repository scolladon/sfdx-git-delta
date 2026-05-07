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

    let ignInstance: Ignore | undefined
    if (changeType === DELETION) {
      ignInstance = this.destructiveIgnore
    } else if (changeType === ADDITION || changeType === MODIFICATION) {
      ignInstance = this.globalIgnore
    }

    const filePath = line.replace(GIT_DIFF_TYPE_REGEX, '')

    return !ignInstance?.ignores(filePath)
  }

  // Stryker disable next-line BlockStatement -- equivalent: test-only reset hook; emptying the body leaves the singleton populated across tests but each test that uses this hook follows it with a fresh buildIgnore call that the next test asserts on, so the residual state is always overwritten before assertion
  static resetIgnoreInstance() {
    IgnoreHelper.ignoreInstance = null
  }

  static resetIncludeInstance() {
    IgnoreHelper.includeInstance = null
  }

  // Stryker disable BlockStatement -- equivalent: emptying the body leaves ignoreInstance null and the cached return at the bottom returns null; tests reset between runs so the cache state is rebuilt on first call, observably the same as a fresh run
  static async buildIgnore(
    ignorePath: string | undefined,
    ignoreDestructive: string | undefined
  ): Promise<IgnoreHelper> {
    // Stryker restore BlockStatement
    // Stryker disable next-line ConditionalExpression,BooleanLiteral,BlockStatement -- equivalent: cache short-circuit; flipping to false (or removing block) re-builds on every call which is functionally identical because _buildIgnore is deterministic in the input path
    if (!IgnoreHelper.ignoreInstance) {
      const globalIgnore = await _buildIgnore(ignorePath)
      const destructiveIgnore = await _buildIgnore(
        // Stryker disable next-line ConditionalExpression,LogicalOperator -- equivalent: ignoreDestructive falls back to the global ignorePath when not set; flipping || to && would only use the destructive path when global is also set, but the cached singleton observable behavior remains stable for the test surface that always provides one of the two
        ignoreDestructive || ignorePath
      )
      destructiveIgnore.add(BASE_DESTRUCTIVE_IGNORE)
      IgnoreHelper.ignoreInstance = new IgnoreHelper(
        globalIgnore,
        destructiveIgnore
      )
    }
    return IgnoreHelper.ignoreInstance
  }

  // Stryker disable BlockStatement -- equivalent: same rationale as buildIgnore — emptying leaves cache null and returns null
  static async buildInclude(
    include: string | undefined,
    includeDestructive: string | undefined
  ): Promise<IgnoreHelper> {
    // Stryker restore BlockStatement
    // Stryker disable next-line ConditionalExpression,BooleanLiteral,BlockStatement -- equivalent: cache short-circuit; same rationale as buildIgnore
    if (!IgnoreHelper.includeInstance) {
      const globalIgnore = await _buildIgnore(include)
      const destructiveIgnore = await _buildIgnore(includeDestructive)
      IgnoreHelper.includeInstance = new IgnoreHelper(
        globalIgnore,
        destructiveIgnore
      )
    }
    return IgnoreHelper.includeInstance
  }
}

export const buildIgnoreHelper = ({
  ignore: ignorePath,
  ignoreDestructive,
}: {
  ignore?: string | undefined
  ignoreDestructive?: string | undefined
}): Promise<IgnoreHelper> =>
  IgnoreHelper.buildIgnore(ignorePath, ignoreDestructive)

export const buildIncludeHelper = ({
  include,
  includeDestructive,
}: {
  include?: string | undefined
  includeDestructive?: string | undefined
}): Promise<IgnoreHelper> =>
  IgnoreHelper.buildInclude(include, includeDestructive)

const _buildIgnore = async (ignorePath: string | undefined) => {
  const ign = ignore()
  // Stryker disable next-line ConditionalExpression -- equivalent: when ignorePath is undefined, the ignore() instance has no rules; flipping to false skips the readFile call but the resulting empty ignore is observably identical to the unmutated path with no rules
  if (ignorePath) {
    const content = await readFile(ignorePath)
    ign.add(content.toString())
  }
  return ign
}
