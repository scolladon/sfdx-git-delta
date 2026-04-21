import { join } from 'node:path/posix'

import { Flags, SfCommand } from '@salesforce/sf-plugins-core'

import {
  CHANGES_MANIFEST_BARE_MARKER,
  CHANGES_MANIFEST_DEFAULT_FILENAME,
  OUTPUT_DEFAULT_VALUE,
  REPO_DEFAULT_VALUE,
  SOURCE_DEFAULT_VALUE,
  TO_DEFAULT_VALUE,
} from '../../../constant/cliConstants.js'
import sgd from '../../../main.js'
import type { Config } from '../../../types/config.js'
import type { SgdResult } from '../../../types/sgdResult.js'
import { log } from '../../../utils/LoggingDecorator.js'
import { Logger } from '../../../utils/LoggingService.js'
import { MessageService } from '../../../utils/MessageService.js'

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
      aliases: ['output'],
      deprecateAliases: true,
    }),
    'repo-dir': Flags.directory({
      char: 'r',
      summary: messages.getMessage('flags.repo.summary'),
      default: REPO_DEFAULT_VALUE,
      exists: true,
      aliases: ['repo'],
      deprecateAliases: true,
    }),
    'source-dir': Flags.directory({
      char: 's',
      summary: messages.getMessage('flags.source.summary'),
      description: messages.getMessage('flags.source.description'),
      default: [SOURCE_DEFAULT_VALUE],
      aliases: ['source'],
      deprecateAliases: true,
      multiple: true,
    }),
    'ignore-file': Flags.file({
      char: 'i',
      summary: messages.getMessage('flags.ignore.summary'),
      exists: true,
      aliases: ['ignore'],
      deprecateAliases: true,
    }),
    'ignore-destructive-file': Flags.file({
      char: 'D',
      summary: messages.getMessage('flags.ignore-destructive.summary'),
      exists: true,
      aliases: ['ignore-destructive'],
      deprecateAliases: true,
    }),
    'include-file': Flags.file({
      char: 'n',
      summary: messages.getMessage('flags.include.summary'),
      exists: true,
      aliases: ['include'],
      deprecateAliases: true,
    }),
    'include-destructive-file': Flags.file({
      char: 'N',
      summary: messages.getMessage('flags.include-destructive.summary'),
      exists: true,
      aliases: ['include-destructive'],
      deprecateAliases: true,
    }),
    'additional-metadata-registry': Flags.file({
      char: 'M',
      summary: messages.getMessage(
        'flags.additional-metadata-registry.summary'
      ),
      exists: true,
    }),
    'changes-manifest': Flags.string({
      char: 'c',
      summary: messages.getMessage('flags.changes-manifest.summary'),
    }),
    'ignore-whitespace': Flags.boolean({
      char: 'W',
      summary: messages.getMessage('flags.ignore-whitespace.summary'),
    }),
    'api-version': Flags.orgApiVersion({
      char: 'a',
      summary: messages.getMessage('flags.api-version.summary'),
    }),
  }

  // oclif's string flags require a value. To let users pass `-c` without a
  // value (and fall back to <output>/changes.manifest.json), rewrite bare
  // occurrences in argv into a known marker that we resolve after parsing.
  protected static _expandBareChangesManifest(argv: string[]): string[] {
    const aliases = new Set(['--changes-manifest', '-c'])
    const result: string[] = []
    for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]!
      result.push(arg)
      if (aliases.has(arg)) {
        const next = argv[i + 1]
        if (next === undefined || next.startsWith('-')) {
          result.push(CHANGES_MANIFEST_BARE_MARKER)
        }
      }
    }
    return result
  }

  @log
  public async run(): Promise<SgdResult> {
    this.argv = SourceDeltaGenerate._expandBareChangesManifest(this.argv)
    const { flags } = await this.parse(SourceDeltaGenerate)

    const rawChangesManifest = flags['changes-manifest']
    const changesManifest =
      rawChangesManifest === CHANGES_MANIFEST_BARE_MARKER
        ? join(flags['output-dir'], CHANGES_MANIFEST_DEFAULT_FILENAME)
        : rawChangesManifest

    const config: Config = {
      apiVersion: parseInt(flags['api-version']!) || undefined,
      additionalMetadataRegistryPath: flags['additional-metadata-registry'],
      changesManifest,
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

    this.spinner.start(
      messages.getMessage('info.CommandIsRunning'),
      undefined,
      { stdout: true }
    )
    const output: SgdResult = {
      'output-dir': config.output,
    }
    let finalMessage = messages.getMessage('info.CommandSuccess')
    try {
      const jobResult = await sgd(config)
      for (const warning of jobResult.warnings) {
        Logger.warn('run: warning', warning)
        this.warn(warning.message)
      }
      this.info(messages.getMessage('info.EncourageSponsorship'))
      Logger.info('run: success')
    } catch (err) {
      if (err instanceof Error) {
        finalMessage = `${messages.getMessage('info.CommandFailure')}: ${
          err.message
        }`
        output.error = err.message
      }
      Logger.error('run: error', err)
      process.exitCode = 1
    }
    this.spinner.stop(finalMessage)
    return output
  }
}
