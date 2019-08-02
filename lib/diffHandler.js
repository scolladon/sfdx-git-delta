'use strict';
const path = require('path')
const os = require('os')
const child_process = require('child_process');
const TypeHandlerFactory = require('./service/typeHandlerFactory');
const metadata = require('./metadata/v46')('directoryName');

const UTF8_ENCODING = 'utf8';

module.exports = class DiffHandler {
  constructor(config) {
    this.config = config;
  }
  diff() {
    return new Promise((resolve, reject) => {
      const fullResult = [];
      if(!this.config.from) {
        const firstCommitSHARaw = child_process.spawnSync('git', ['rev-list', '--max-parents=0', 'HEAD'],{
            'cwd': this.config.repo
          }).stdout;
        const firstCommitSHA = Buffer.from(firstCommitSHARaw);
        this.config.from = firstCommitSHA.toString(UTF8_ENCODING).trim();
      }
      const child = child_process.spawn('git', ['diff', '--name-status', '--no-renames', this.config.from, this.config.to], {
        'cwd': this.config.repo
      });
      child.stdout.on('data', data => {
        fullResult.push(Buffer.from(data).toString(UTF8_ENCODING));
      });
      child.on('close', code => {
        const work ={
          'diffs': {},
          'promises': [],
          'config':this.config
        } 
        const typeHandlerFactory = new TypeHandlerFactory(work);
        fullResult.join('')
        .split(os.EOL)
        .filter(line=>line.split(path.sep).some(part=>metadata.hasOwnProperty(part)))
        .forEach(line => typeHandlerFactory.getTypeHander(line).handle())
        Promise.all(work.promises.map(p => p.catch(e => console.warn(e.message))))
        .then(()=>resolve(work.diffs))
      });
      child.stderr.on('data', data => {
        reject(Buffer.from(data).toString(UTF8_ENCODING));
      });
    });
  }
}