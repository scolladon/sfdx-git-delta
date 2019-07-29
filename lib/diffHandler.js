'use strict';
const path = require('path')
const fs = require('fs')
const child_process = require('child_process');
const metadata = require('./metadata/v46.json').reduce((p,c)=>{p[c.directoryName]=c; return p},{});
const fileUtils = require('./utils/fileUtils');
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

          if(line.startsWith('D') && !line.endsWith(METAFILE_SUFFIX) && !line.endsWith('.xml')) {
            (diffs[xmlType] || new Set())
            .add(line.split('/').filter((part,index)=>~indexes.indexOf(index-1)).join('.').replace(/\..*?$/,''));
          } else {
            try {
              line = line.replace(/^[AM]\s*/,'');
              if(metadata[xmlType].metaFile == true) {
                line = line.replace(METAFILE_SUFFIX,'');
              }

              const source = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `${this.config.repo}/${line.split('/').slice(0,-1).join('/')}` : `${this.config.repo}/${line}`);
              const target = path.normalize(~['aura','lwc'].indexOf(xmlType) ? `${this.config.output}/${line.split('/').slice(0,-1).join('/')}` : `${this.config.output}/${line}`);

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
                  fileUtils.copyFileSync(path.normalize(`${srcPath}/${src}`),path.normalize(`${targetPath}/${src}`))
                })
              } else {
                fileUtils.copyFileSync(source, target);
                if(metadata[xmlType].metaFile === true) {
                  fileUtils.copyFileSync(`${source}${METAFILE_SUFFIX}`, `${target}${METAFILE_SUFFIX}`)
                }
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