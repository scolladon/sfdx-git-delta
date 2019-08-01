'use strict';
const path = require('path')
const child_process = require('child_process');
const TypeHandlerFactory = require('./service/typeHandlerFactory');
const metadata = require('./metadata/v46')('directoryName');

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
        this.config.from = firstCommitSHA.toString('utf8').trim();
      }
      const child = child_process.spawn('git', ['diff', '--name-status', this.config.from, this.config.to], {
        'cwd': this.config.repo
      });
      child.stdout.on('data', data => {
        fullResult.push(Buffer.from(data).toString('utf8'));
      });
      child.on('close', code => {
        const work ={
          'diffs': {},
          'promises': [],
          'config':this.config
        } 
        const typeHandlerFactory = new TypeHandlerFactory(work);
        fullResult.join('')
        .split('\n')
        .filter(line=>line.split(path.sep).some(part=>metadata.hasOwnProperty(part)))
        .forEach(line => typeHandlerFactory.getTypeHander(line).build())
        Promise.all(work.promises.map(p => p.catch(e => console.warn(err.message))))
        .then(()=>resolve(work.diffs))
      });
      child.stderr.on('data', data => {
        reject(Buffer.from(data).toString('utf8'));
      });
    });
  }
}