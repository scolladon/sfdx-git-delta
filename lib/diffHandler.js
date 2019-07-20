'use strict';
const fs = require('fs')
const fse = require('fs-extra')
const child_process = require('child_process');
const metadata = require('./metadata/v46.json').reduce((p,c)=>{p[c.directoryName]=c; return p},{});
const METAFILE_SUFFIX = '-meta.xml';

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
        const diffs = {}
        fullResult.join('')
        .split('\n')
        .filter(line=>line.split('/').some(part=>metadata.hasOwnProperty(part)))
        .filter(line=>!line.endsWith('jsconfig.json'))
        .reduce((promises,line) => {
            const explodedLine = line.split('/');
            const indexes = [];
            explodedLine.forEach((v,i)=> metadata.hasOwnProperty(v) && indexes.push(i))
            const xmlType = explodedLine[indexes[indexes.length-1]]

            if(line.startsWith('D') && !line.endsWith(METAFILE_SUFFIX) && !line.endsWith('.xml')) {
                diffs[xmlType] = diffs[xmlType] || new Set();
                const elementName = explodedLine.filter((part,index)=>~indexes.indexOf(index-1)).join('.').replace(/\..*?$/,'')
                diffs[xmlType].add(elementName);
            } else {
                line = line.replace(/^[AMD]\s*/,'');
                explodedLine[0] = this.config.output
                console.log(`${explodedLine.slice(0,-1).join('/')}`)
                try {
                  fs.mkdirSync(`${explodedLine.slice(0,-1).join('/')}`,{ recursive: true });
                  promises.push(fs.copyFileSync(`${this.config.repo}/${line}`, explodedLine.join('/')))
                  if(metadata[xmlType].metaFile === true) {
                      promises.push(fs.copyFileSync(`${this.config.repo}/${line}${METAFILE_SUFFIX}`, `${explodedLine.join('/')}${METAFILE_SUFFIX}`))
                  }
                } catch(err) {
                  console.log(err)
              }
                return promises;
            } 
        },[]);
        resolve()
      });
      child.stderr.on("data", data => {
        reject(Buffer.from(data).toString('utf8'));
      });
    });
  }
}