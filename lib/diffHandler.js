'use strict';
const child_process = require('child_process');
const CleanUpRepo = require('./cleanUpRepo');
const metadata = require('./utils/metadata');

module.exports = class DiffHandler {
  constructor(config) {
    this.config = config;
  }
  diff() {
    return new Promise((resolve, reject) => {
      const fullResult = [];
      if(!this.config.from) {
        const firstCommitSHARaw = child_process.spawnSync('git', ['rev-list', '--max-parents=0', 'HEAD'],{
            "cwd": this.config.repo
          }).stdout;
        const firstCommitSHA = Buffer.from(firstCommitSHARaw);
        this.config.from = firstCommitSHA.toString('utf8').trim();
      }
      const child = child_process.spawn("git", ["diff", "--name-status", this.config.from, this.config.to], {
        "cwd": this.config.repo
      });
      child.stdout.on('data', data => {
        fullResult.push(Buffer.from(data).toString('utf8'));
      });
      child.on('close', code => {
        const diffs = {
            'package.xml' : {},
            'destructiveChangesPre.xml' : {}
          }
        fullResult.join('')
        .split('\n')
        .filter(line=>line.split('/').some(part=>metadata.hasOwnProperty(part)))
        .map(line=>line.replace(/-meta.xml$/,''))
        .filter(line=>!line.endsWith('.xml'))
        .map(line=>line.replace(/\..*?$/,''))
        .forEach(line => {
          const context = line.startsWith('D') ? diffs['destructiveChangesPre.xml'] : diffs['package.xml'];
          const explodedLine = line.split('/');
          const indexes = [];
          explodedLine.forEach((v,i)=> metadata.hasOwnProperty(v) && indexes.push(i))
          const xmlType = indexes[indexes.length-1]
          context[explodedLine[xmlType]] = context[explodedLine[xmlType]] || new Set();
          const elementName = explodedLine.filter((part,index)=>~indexes.indexOf(index-1)).join('.')
          context[explodedLine[xmlType]].add(elementName);
        });
        if(this.config.clean === true) {
          const cur = new CleanUpRepo(this.config,diffs['package.xml']);
          cur.cleanUpRepo();
        }

        resolve(diffs);
      });
      child.stderr.on("data", data => {
        reject(Buffer.from(data).toString('utf8'));
      });
    });
  }
}