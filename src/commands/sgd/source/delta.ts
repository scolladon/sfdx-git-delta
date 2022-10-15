import { flags, SfdxCommand } from '@salesforce/command'
import { Messages } from '@salesforce/core'
import { AnyJson } from '@salesforce/ts-types'
import * as sgd from '../../../main'
const {
  TO_DEFAULT_VALUE,
  REPO_DEFAULT_VALUE,
  SOURCE_DEFAULT_VALUE,
  OUTPUT_DEFAULT_VALUE,
} = require('../../../utils/cliHelper')

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname)
const COMMAND_NAME = 'delta'

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-git-delta', COMMAND_NAME)

export default class SourceDeltaGenerate extends SfdxCommand {
  public static description = messages.getMessage('command', [])

  protected static flagsConfig = {
    to: flags.string({
      char: 't',
      description: messages.getMessage('toFlag'),
      default: TO_DEFAULT_VALUE,
    }),
    from: flags.string({
      char: 'f',
      description: messages.getMessage('fromFlag'),
      required: true,
    }),
    repo: flags.filepath({
      char: 'r',
      description: messages.getMessage('repoFlag'),
      default: REPO_DEFAULT_VALUE,
    }),
    ignore: flags.filepath({
      char: 'i',
      description: messages.getMessage('ignoreFlag'),
    }),
    'ignore-destructive': flags.filepath({
      char: 'D',
      description: messages.getMessage('ignoreDestructiveFlag'),
    }),
    source: flags.filepath({
      char: 's',
      description: messages.getMessage('sourceFlag'),
      default: SOURCE_DEFAULT_VALUE,
    }),
    'ignore-whitespace': flags.boolean({
      char: 'W',
      description: messages.getMessage('ignoreWhitespaceFlag'),
    }),
    output: flags.filepath({
      char: 'o',
      description: messages.getMessage('outputFlag'),
      default: OUTPUT_DEFAULT_VALUE,
    }),
    'api-version': flags.number({
      char: 'a',
      description: messages.getMessage('apiVersionFlag'),
    }),
    'generate-delta': flags.boolean({
      char: 'd',
      description: messages.getMessage('deltaFlag'),
    }),
    include: flags.filepath({
      char: 'n',
      description: messages.getMessage('includeFlag'),
    }),
    'include-destructive': flags.filepath({
      char: 'N',
      description: messages.getMessage('includeDestructiveFlag'),
    }),
  }

  public async run(): Promise<AnyJson> {
    const output = {
      error: null,
      output: this.flags.output,
      success: true,
      warnings: [],
    }
    try {
      const jobResult = await sgd({
        to: this.flags.to,
        from: this.flags.from,
        output: this.flags.output,
        source: this.flags.source,
        ignore: this.flags.ignore,
        ignoreDestructive: this.flags['ignore-destructive'],
        apiVersion: this.flags['api-version'],
        repo: this.flags.repo,
        ignoreWhitespace: this.flags['ignore-whitespace'],
        generateDelta: this.flags['generate-delta'],
        include: this.flags.include,
        includeDestructive: this.flags['include-destructive'],
      })
      output.warnings = jobResult?.warnings?.map(warning => warning.message)
    } catch (err) {
      output.success = false
      output.error = err.message
      process.exitCode = 1
    }
    this.ux.log(JSON.stringify(output, null, 2))
    return null
  }
}
