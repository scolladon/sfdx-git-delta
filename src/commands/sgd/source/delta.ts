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

import { camelCase } from 'lodash-es'

const messages = new MessageService()

export default class SourceDeltaGenerate extends SfCommand<SgdResult> {
  public static override readonly summary = messages.getMessage('summary')
  public static override readonly description =
    messages.getMessage('description')
  public static override readonly examples = messages.getMessages('examples')

  public static override readonly flags = {
    from: Flags.string({
      char: 'f',
      summary: messages.getMessage('flags.from.summary'),
      required: true,
    }),
    to: Flags.string({
      char: 't',
      summary: messages.getMessage('flags.to.summary'),
      default: TO_DEFAULT_VALUE,
    }),
    'generate-delta': Flags.boolean({
      char: 'd',
      summary: messages.getMessage('flags.generate-delta.summary'),
    }),
    'output-dir': Flags.directory({
      char: 'o',
      summary: messages.getMessage('flags.output.summary'),
      default: OUTPUT_DEFAULT_VALUE,
      exists: true,
    }),
    'repo-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.repo.summary'),
      default: REPO_DEFAULT_VALUE,
      exists: true,
    }),
    'source-dir': Flags.directory({
      char: 's',
      summary: messages.getMessage('flags.source.summary'),
      default: SOURCE_DEFAULT_VALUE,
      exists: true,
    }),
    'ignore-file': Flags.file({
      char: 'i',
      summary: messages.getMessage('flags.ignore.summary'),
      exists: true,
    }),
    'ignore-destructive-file': Flags.file({
      char: 'D',
      summary: messages.getMessage('flags.ignore-destructive.summary'),
      exists: true,
    }),
    'include-file': Flags.file({
      char: 'n',
      summary: messages.getMessage('flags.include.summary'),
      exists: true,
    }),
    'include-destructive-file': Flags.file({
      char: 'N',
      summary: messages.getMessage('flags.include-destructive.summary'),
      exists: true,
    }),
    'ignore-whitespace': Flags.boolean({
      char: 'W',
      summary: messages.getMessage('flags.ignore-whitespace.summary'),
    }),
    'api-version': Flags.integer({
      char: 'a',
      summary: messages.getMessage('flags.api-version.summary'),
    }),
    // Deprecated flags start
    ignore: Flags.file({
      summary: messages.getMessage('flags.deprecated', ['ignore-file']),
      exists: true,
    }),
    'ignore-destructive': Flags.file({
      summary: messages.getMessage('flags.deprecated', [
        'ignore-destructive-file',
      ]),
      exists: true,
    }),
    include: Flags.file({
      summary: messages.getMessage('flags.deprecated', ['include-file']),
      exists: true,
    }),
    'include-destructive': Flags.file({
      summary: messages.getMessage('flags.deprecated', [
        'include-destructive-file',
      ]),
      exists: true,
    }),
    output: Flags.directory({
      summary: messages.getMessage('flags.deprecated', ['output-dir']),
      exists: true,
    }),
    repo: Flags.directory({
      summary: messages.getMessage('flags.deprecated', ['repo-dir']),
      exists: true,
    }),
    source: Flags.directory({
      summary: messages.getMessage('flags.deprecated', ['source-dir']),
      exists: true,
    }),
  }

  public async run(): Promise<SgdResult> {
    const { flags } = await this.parse(SourceDeltaGenerate)

    const config: Config = {
      apiVersion: flags['api-version'],
      from: flags['from'],
      generateDelta: flags['generate-delta'],
      ignore: flags['ignore-file'],
      ignoreDestructive: flags['ignore-destructive-file'],
      ignoreWhitespace: flags['ignore-whitespace'],
      include: flags['include-file'],
      includeDestructive: flags['include-destructive-file'],
      output: flags['output-dir'],
      repo: flags['repo-dir'],
      source: flags['source-dir'],
      to: flags['to'],
    }

    this.recoverOldParametersUsage(config, flags)

    this.spinner.start(
      messages.getMessage('info.CommandIsRunning'),
      undefined,
      { stdout: true }
    )
    const output: SgdResult = {
      'output-dir': config.output,
    }
    try {
      const jobResult = await sgd(config)
      jobResult.warnings?.forEach(this.warn)
      this.info(messages.getMessage('info.EncourageSponsorship'))
    } catch (err) {
      if (err instanceof Error) {
        output.error = err.message
      }
      process.exitCode = 1
    }
    this.spinner.stop(messages.getMessage('info.CommandHasRun'))
    return output
  }

  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  private recoverOldParametersUsage(config: Config, flags: any) {
    for (const [oldParameter, newParameter] of Object.entries({
      ignore: 'ignore-file',
      'ignore-destructive': 'ignore-destructive-file',
      include: 'include-file',
      'include-destructive': 'include-destructive-file',
      output: 'output-dir',
      repo: 'repo-dir',
      source: 'source-dir',
    })) {
      if (oldParameter in flags) {
        this.warn(
          messages.getMessage('warning.oldParameters', [
            oldParameter,
            newParameter,
          ])
        )
        const configAttribut = camelCase(oldParameter) as never
        config[configAttribut] = flags[oldParameter as never] as never
      }
    }
  }
}
