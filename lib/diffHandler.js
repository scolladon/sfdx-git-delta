'use strict';
const path = require('path')
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
        const staticResourcesSrc = {};
        fullResult.join('')
        .split('\n')
        .filter(line=>line.split('/').some(part=>metadata.hasOwnProperty(part)))
        .forEach(line => {
          const xmlType = line.split('/').reduce((p,v)=> metadata.hasOwnProperty(v) ? v : p  ,'')
          const splittedLine = line.split('/')

          if(line.startsWith('D') && ((metadata[xmlType].metaFile === true && !line.endsWith(METAFILE_SUFFIX)) || metadata[xmlType].metaFile === false)) {
            diffs[xmlType] = diffs[xmlType] || new Set();
            const prefix = metadata[xmlType].sourceStructure === true ? `${splittedLine[splittedLine.indexOf(xmlType) - 1]}.` : '' ;
            const elementName = splittedLine[splittedLine.indexOf(xmlType)+1].replace(METAFILE_SUFFIX,'').replace(`.${metadata[xmlType].suffix}`,'');
            diffs[xmlType].add(`${prefix}${elementName}`);
          } else if(/^[AM]/.test(line)) {
            try {
              line = line.replace(/^[AM]\s*/,'');
              splittedLine[0] = splittedLine[0].replace(/^[AM]\s*/,'');
              if(metadata[xmlType].metaFile === true) {
                line = line.replace(METAFILE_SUFFIX,'');
              }

              const source = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `${this.config.repo}/${splittedLine.slice(0,-1).join('/')}` : `${this.config.repo}/${line}`);
              const target = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `${this.config.output}/${splittedLine.slice(0,-1).join('/')}` : `${this.config.output}/${line}`);

              if(xmlType === 'staticresources') {
                // use this regex because a resource static can be a folder.
                // And we should copy the root folder of the resource static
                const regexResult = source.match(/(.*\/staticresources)\/([^\/]*)+/)
                const resourceName = path.parse(regexResult[2].replace('resource','')).name;
                const srcPath = regexResult[1];
                const targetPath = target.match(/.*\/staticresources/)[0]
                if(!staticResourcesSrc.hasOwnProperty(`${srcPath}`)) {
                  staticResourcesSrc[srcPath] = fs.readdirSync(`${srcPath}`);
                }
                staticResourcesSrc[srcPath].filter(src=>~src.indexOf(`${resourceName}`))
                .forEach(src => {
                  fse.copySync(path.normalize(`${srcPath}/${src}`),path.normalize(`${targetPath}/${src}`))
                })
              } else {
                fse.copySync(source, target);
                if(metadata[xmlType].metaFile === true) {
                  fse.copySync(`${source}${METAFILE_SUFFIX}`, `${target}${METAFILE_SUFFIX}`)
                }
              }              
            } catch(err) {
              console.warn(err.message);
            }
          } 
        })
        resolve(diffs);        
      });
      child.stderr.on("data", data => {
        reject(Buffer.from(data).toString('utf8'));
      });
    });
  }
}