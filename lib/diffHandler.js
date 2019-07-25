'use strict';
const path = require('path')
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
        .reduce((promise,line) => {
          const explodedLine = line.split('/');          
          const xmlType = explodedLine.reduce((p,v)=> metadata.hasOwnProperty(v) ? v : p  ,'')

          if(line.startsWith('D') && !line.endsWith(METAFILE_SUFFIX) && !line.endsWith('.xml')) {
            diffs[xmlType] = diffs[xmlType] || new Set();
            const elementName = explodedLine.filter((part,index)=>~indexes.indexOf(index-1)).join('.').replace(/\..*?$/,'')
            diffs[xmlType].add(elementName);
          } else {
            line = line.replace(/^[AM]\s*/,'');
            explodedLine[0] = this.config.output
            try {
              const source = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `${this.config.repo}/${line.split('/').slice(0,-1).join('/')}` : `${this.config.repo}/${line}`);
              const target = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `./${explodedLine.slice(0,-1).join('/')}` : `./${explodedLine.join('/')}`);
              const sourceMeta = xmlType === 'staticresources' ? `${source.replace(/\.[^.]*?$/,'.resource')}${METAFILE_SUFFIX}` : `${source}${METAFILE_SUFFIX}`
              const targetMeta = xmlType === 'staticresources' ? `${target.replace(/\.[^.]*?$/,'.resource')}${METAFILE_SUFFIX}` : `${target}${METAFILE_SUFFIX}`

              return promise.then(()=> 
                metadata[xmlType].metaFile === true && !source.endsWith(METAFILE_SUFFIX) ?
                fse.copy(source, target).then(()=>fse.copy(sourceMeta, targetMeta)) :
                fse.copy(source, target)
              )
            } catch(err) {
              console.error(err);
            }
          } 
        }, Promise.resolve())
        .then(()=>resolve())
        .catch(err => reject(err))
      });
      child.stderr.on("data", data => {
        reject(Buffer.from(data).toString('utf8'));
      });
    });
  }
}