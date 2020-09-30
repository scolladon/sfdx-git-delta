import { flags, SfdxCommand } from '@salesforce/command';
import { Messages } from '@salesforce/core';
import { AnyJson } from '@salesforce/ts-types';
import * as sgd from '../../../index.js';

// Initialize Messages with the current plugin directory
Messages.importMessagesDirectory(__dirname);

// Load the specific messages for this file. Messages from @salesforce/command, @salesforce/core,
// or any library that is using the messages framework can also be loaded this way.
const messages = Messages.loadMessages('sfdx-plugin-ci', 'delta');

export default class SourceDeltaGenerate extends SfdxCommand {

    public static description = messages.getMessage('command', []);

    protected static flagsConfig = {
        to: flags.string({ char: 't', description: messages.getMessage('toFlag'), default: 'HEAD' }),
        from: flags.string({ char: 'f', description: messages.getMessage('fromFlag') }),
        output: flags.filepath({ char: 'o', description: messages.getMessage('outputFlag'), default: './output' }),
        'api-version': flags.number({ char: 'a', description: messages.getMessage('apiVersionFlag'), default: 48.0 }),
        repo: flags.filepath({ char: 'r', description: messages.getMessage('repoFlag'), default: '.' }),
        'generate-delta': flags.boolean({ char: 'd', description: messages.getMessage('deltaFlag')})
    };

    protected static requiresProject = false;

    public async run(): Promise<AnyJson> {
        return sgd({
            to: this.flags.to,
            from: this.flags.from,
            output: this.flags.output,
            apiVersion: this.flags['api-version'],
            repo: this.flags.repo,
            generateDelta: this.flags['generate-delta']
        }, this.ux.log);
    }
}
