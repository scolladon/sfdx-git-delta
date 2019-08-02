const metadata = require('../metadata/v46')('directoryName');
const StandardHandler = require('./StandardHandler');

class SubCustomObjectHandler extends StandardHandler {
  constructor(line,type,work) {
    super(line,type,work);
  }

  handle(){
    !!this.handlerMap[this.changeType] && this.handlerMap[this.changeType].apply(this);
  }

  handleDeletion(){
    if((metadata[this.type].metaFile === true && !this.line.endsWith(StandardHandler.METAFILE_SUFFIX)) || metadata[this.type].metaFile === false) {
      this.diffs[this.type] = this.diffs[this.type] || new Set();
      const prefix = `${this.splittedLine[this.splittedLine.indexOf(this.type) - 1]}`;
      const elementName = this.splittedLine[this.splittedLine.indexOf(this.type)+1].replace(StandardHandler.METAFILE_SUFFIX,'').replace(`.${metadata[this.type].suffix}`,'');
      this.diffs[this.type].add(`${prefix}.${elementName}`);
    }
  }
};

module.exports = SubCustomObjectHandler;