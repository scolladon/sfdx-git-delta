import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as sgd from '../../../main.js';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);
const COMMAND_NAME = 'delta';

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-git-delta', COMMAND_NAME);

export default class SourceDeltaGenerate extends SfdxCommand {

    public static description = messages.getMessage('command', []);

    protected static flagsConfig = {
        to: flags.string({ char: 't', description: messages.getMessage('toFlag'), default: 'HEAD' }),
        from: flags.string({ char: 'f', description: messages.getMessage('fromFlag'), required: true }),
        repo: flags.filepath({ char: 'r', description: messages.getMessage('repoFlag'), default: '.' }),
        ignore: flags.filepath({ char: 'i', description: messages.getMessage('ignoreFlag')}),
        output: flags.filepath({ char: 'o', description: messages.getMessage('outputFlag'), default: './output' }),
        'api-version': flags.number({ char: 'a', description: messages.getMessage('apiVersionFlag'), default: 50.0 }),
        'generate-delta': flags.boolean({ char: 'd', description: messages.getMessage('deltaFlag')})
    };

    public async run(): Promise<AnyJson> {

      const output = {
        error: null,
        output: this.flags.output,
        success: true,
        warnings: []
      };
      try {
        const jobResult = sgd({
          to: this.flags.to,
          from: this.flags.from,
          output: this.flags.output,
          ignore: this.flags.ignore,
          apiVersion: this.flags['api-version'],
          repo: this.flags.repo,
          generateDelta: this.flags['generate-delta']
        });
        output.warnings = jobResult?.warnings?.map(warning => warning.message);
      } catch (err) {
        output.success = false;
        output.error = err.message;
        process.exitCode = 1;
      }
      this.ux.log(JSON.stringify(output, null, 2));
      return null;
    }
}
