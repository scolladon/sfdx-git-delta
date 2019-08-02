const metadata = require('../metadata/v46')('directoryName');
const StandardHandler = require('./StandardHandler');
const path = require('path')

class InFolderHandler extends StandardHandler {
  constructor(line,type,work) {
    super(line,type,work);
  }

  handle(){
    !!this.handlerMap[this.changeType] && this.handlerMap[this.changeType].apply(this);
  }

  handleDeletion(){
    if((metadata[this.type].metaFile === true && !this.line.endsWith(StandardHandler.METAFILE_SUFFIX)) || metadata[this.type].metaFile === false) {
      this.diffs[this.type] = this.diffs[this.type] || new Set();
      this.diffs[this.type].add(this.splittedLine.slice(this.splittedLine.indexOf(this.type)+1).join(path.sep).replace(StandardHandler.METAFILE_SUFFIX,'').replace(`.${metadata[this.type].suffix}`,''));
    }
  }
};

module.exports = InFolderHandler;