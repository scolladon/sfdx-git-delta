'use strict';
const path = require('path')
const fse = require('fs-extra')
const fs = require('fs')
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
        .forEach(line => {
          const explodedLine = line.split('/');          
          const xmlType = explodedLine.reduce((p,v)=> metadata.hasOwnProperty(v) ? v : p  ,'')

          if(line.startsWith('D') && !line.endsWith(METAFILE_SUFFIX) && !line.endsWith('.xml')) {
            diffs[xmlType] = diffs[xmlType] || new Set();
            const elementName = explodedLine.filter((part,index)=>~indexes.indexOf(index-1)).join('.').replace(/\..*?$/,'')
            diffs[xmlType].add(elementName);
          } else {
            try {
              line = line.replace(/^[AM]\s*/,'').replace(METAFILE_SUFFIX,'');
              explodedLine[0] = this.config.output;

              const source = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `${this.config.repo}/${line.split('/').slice(0,-1).join('/')}` : `${this.config.repo}/${line}`);
              const target = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `./${explodedLine.slice(0,-1).join('/')}` : `./${explodedLine.join('/')}`);
              

              if(xmlType === 'staticresources') {
                // use this regex because a resource static can be a folder.
                // And we should copy the root folder of the resource static
                const regexResult = source.match(/(.*\/staticresources)\/([^\/]*)+/)
                const resourceName = path.parse(regexResult[2].replace('resource','')).name;
                const srcPath = regexResult[1];
                const targetPath = target.match(/.*\/staticresources/)[0]
                fs.readdirSync(`${srcPath}`)
                .filter(src=>~src.indexOf(`${resourceName}`))
                .forEach(src => {
                  fse.copySync(`${srcPath}/${src}`,`${targetPath}/${src}`)
                })
              } else {
                metadata[xmlType].metaFile === true ?
                    fse.copySync(source, target) && fse.copy(`${source}${METAFILE_SUFFIX}`, `${target}${METAFILE_SUFFIX}`) :
                    fse.copySync(source, target)
              }              
            } catch(err) {
              console.error(err);
            }
          } 
        })
        resolve();        
      });
      child.stderr.on("data", data => {
        reject(Buffer.from(data).toString('utf8'));
      });
    });
  }
}