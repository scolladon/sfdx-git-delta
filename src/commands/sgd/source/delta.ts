import { Messages } from '@salesforce/core'
import { Flags, SfCommand } from '@salesforce/sf-plugins-core'

import sgd from '../../../main.js'
import type { Config } from '../../../types/config.js'
import type { SgdResult } from '../../../types/sgdResult.js'
import {
  OUTPUT_DEFAULT_VALUE,
  REPO_DEFAULT_VALUE,
  SOURCE_DEFAULT_VALUE,
  TO_DEFAULT_VALUE,
} from '../../../utils/cliConstants.js'

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url)
const COMMAND_NAME = 'delta'

const messages = Messages.loadMessages('sfdx-git-delta', COMMAND_NAME)

export default class SourceDeltaGenerate extends SfCommand<SgdResult> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    to: Flags.string({
      char: 't',
      summary: messages.getMessage('flags.to.summary'),
      default: TO_DEFAULT_VALUE,
    }),
    from: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.from.summary'),
      required: true,
    }),
    repo: Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.repo.summary'),
      default: REPO_DEFAULT_VALUE,
      exists: true,
    }),
    ignore: Flags.file({
      char: 'i',
      summary: messages.getMessage('flags.ignore.summary'),
      exists: true,
    }),
    'ignore-destructive': Flags.file({
      char: 'D',
      summary: messages.getMessage('flags.ignore-destructive.summary'),
      exists: true,
    }),
    source: Flags.directory({
      char: 's',
      summary: messages.getMessage('flags.source.summary'),
      default: SOURCE_DEFAULT_VALUE,
      exists: true,
    }),
    'ignore-whitespace': Flags.boolean({
      char: 'W',
      summary: messages.getMessage('flags.ignore-whitespace.summary'),
    }),
    output: Flags.directory({
      char: 'o',
      summary: messages.getMessage('flags.output.summary'),
      default: OUTPUT_DEFAULT_VALUE,
    }),
    'api-version': Flags.integer({
      char: 'a',
      summary: messages.getMessage('flags.api-version.summary'),
    }),
    'generate-delta': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.generate-delta.summary'),
    }),
    include: Flags.file({
      char: 'n',
      summary: messages.getMessage('flags.include.summary'),
      exists: true,
    }),
    'include-destructive': Flags.file({
      char: 'N',
      summary: messages.getMessage('flags.include-destructive.summary'),
      exists: true,
    }),
  }

  public async run(): Promise<SgdResult> {
    const { flags } = await this.parse(SourceDeltaGenerate)
    const output: SgdResult = {
      error: null,
      output: flags['output'],
      success: true,
      warnings: [],
    }
    const config: Config = {
      to: flags['to'],
      from: flags['from'],
      output: flags['output'],
      source: flags['source'],
      ignore: flags['ignore'],
      ignoreDestructive: flags['ignore-destructive'],
      apiVersion: flags['api-version'],
      repo: flags['repo'],
      ignoreWhitespace: flags['ignore-whitespace'],
      generateDelta: flags['generate-delta'],
      include: flags['include'],
      includeDestructive: flags['include-destructive'],
    }
    try {
      const jobResult = await sgd(config)
      if (jobResult.warnings?.length > 0) {
        output.warnings = jobResult.warnings.map(
          (warning: Error) => warning.message
        )
      }
    } catch (err) {
      if (err instanceof Error) {
        output.error = err.message
      }
      output.success = false
      process.exitCode = 1
    }
    return output
  }
}
