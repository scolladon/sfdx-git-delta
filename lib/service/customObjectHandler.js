const metadata = require('../metadata/v46')('directoryName');
const StandardHandler = require('./StandardHandler');

const staticResourcesSrc = {};

class CustomObjectHandler extends StandardHandler {
  constructor(line,type,work) {
    super(line,type,work);
  }

  handle(){
    !!this.handlerMap[this.changeType] && this.handlerMap[this.changeType].apply(this);
  }
};

module.exports = CustomObjectHandler;