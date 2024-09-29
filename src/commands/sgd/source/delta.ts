import { Flags, SfCommand } from '@salesforce/sf-plugins-core'

import sgd from '../../../main.js'
import type { Config } from '../../../types/config.js'
import type { SgdResult } from '../../../types/sgdResult.js'
import { MessageService } from '../../../utils/MessageService.js'
import {
  OUTPUT_DEFAULT_VALUE,
  REPO_DEFAULT_VALUE,
  SOURCE_DEFAULT_VALUE,
  TO_DEFAULT_VALUE,
} from '../../../utils/cliConstants.js'

const messages = new MessageService()

export default class SourceDeltaGenerate extends SfCommand<SgdResult> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    'api-version': Flags.integer({
      char: 'a',
      summary: messages.getMessage('flags.api-version.summary'),
    }),
    from: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.from.summary'),
      required: true,
    }),
    'generate-delta': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.generate-delta.summary'),
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
    'ignore-whitespace': Flags.boolean({
      char: 'W',
      summary: messages.getMessage('flags.ignore-whitespace.summary'),
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
    output: Flags.directory({
      char: 'o',
      summary: messages.getMessage('flags.output.summary'),
      default: OUTPUT_DEFAULT_VALUE,
      exists: true,
    }),
    repo: Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.repo.summary'),
      default: REPO_DEFAULT_VALUE,
      exists: true,
    }),
    source: Flags.directory({
      char: 's',
      summary: messages.getMessage('flags.source.summary'),
      default: SOURCE_DEFAULT_VALUE,
      exists: true,
    }),
    to: Flags.string({
      char: 't',
      summary: messages.getMessage('flags.to.summary'),
      default: TO_DEFAULT_VALUE,
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
      apiVersion: flags['api-version'],
      from: flags['from'],
      generateDelta: flags['generate-delta'],
      ignore: flags['ignore'],
      ignoreDestructive: flags['ignore-destructive'],
      ignoreWhitespace: flags['ignore-whitespace'],
      include: flags['include'],
      includeDestructive: flags['include-destructive'],
      output: flags['output'],
      repo: flags['repo'],
      source: flags['source'],
      to: flags['to'],
    }
    this.spinner.start(
      messages.getMessage('info.CommandIsRunning'),
      undefined,
      { stdout: true }
    )
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
    this.spinner.stop(messages.getMessage('info.CommandHasRun'))
    return output
  }
}
