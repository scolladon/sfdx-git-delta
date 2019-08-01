const metadata = require('../metadata/v46')('directoryName');
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')

const staticResourcesSrc = {};

class StandardHandler {
  constructor(line,type,work) {
    this.line = line;
    this.type = type;
    this.diffs = work.diffs;
    this.promises = work.promises;
    this.config = work.config;
  }

  build(){
    const splittedLine = this.line.split(path.sep)

    if(this.line.startsWith('D') && ((metadata[this.type].metaFile === true && !this.line.endsWith(StandardHandler.METAFILE_SUFFIX)) || metadata[this.type].metaFile === false)) {
        this.diffs[this.type] = this.diffs[this.type] || new Set();
        const prefix = metadata[this.type].sourceStructure === true ? `${splittedLine[splittedLine.indexOf(this.type) - 1]}.` : '' ;
        const elementName = splittedLine[splittedLine.indexOf(this.type)+1].replace(StandardHandler.METAFILE_SUFFIX,'').replace(`.${metadata[this.type].suffix}`,'');
        this.diffs[this.type].add(`${prefix}${elementName}`);
    } else if(/^[AM]/.test(this.line)) {
        this.line = this.line.replace(/^[AM]\s*/,'');
        splittedLine[0] = splittedLine[0].replace(/^[AM]\s*/,'');
        if(metadata[this.type].metaFile === true) {
            this.line = this.line.replace(StandardHandler.METAFILE_SUFFIX,'');
        }

        const source = path.normalize(~['aura','lwc'].indexOf(this.type) ? path.join(this.config.repo,splittedLine.slice(0,-1).join(path.sep)) : path.join(this.config.repo,this.line));
        const target = path.normalize(~['aura','lwc'].indexOf(this.type) ? path.join(this.config.output,splittedLine.slice(0,-1).join(path.sep)) : path.join(this.config.output,this.line));

        if(this.type === 'staticresources') {
            // use this regex because a resource static can be a folder.
            // And we should copy the root folder of the resource static
            const regexResult = source.match(/(.*[\/\\]staticresources)\/([^\/\\]*)+/)
            const resourceName = `${path.parse(regexResult[2].replace('resource','')).name}`;
            const srcPath = `${regexResult[1]}`;
            const targetPath = `${target.match(/.*[\/\\]staticresources/)[0]}`
            if(!staticResourcesSrc.hasOwnProperty(srcPath)) {
            staticResourcesSrc[srcPath] = fs.readdirSync(srcPath);
            }
            staticResourcesSrc[srcPath].filter(src=>~src.indexOf(resourceName))
            .forEach(src => {
              this.promises.push(fse.copy(path.normalize(path.join(srcPath,src)),path.normalize(path.join(targetPath,src))))
            })
        } else {
          this.promises.push(fse.copy(source, target));
            if(metadata[this.type].metaFile === true) {
              this.promises.push(fse.copy(source+StandardHandler.METAFILE_SUFFIX, target+StandardHandler.METAFILE_SUFFIX))
            }
        }
    } 
  }
};

StandardHandler.METAFILE_SUFFIX = '-meta.xml';
module.exports = StandardHandler;