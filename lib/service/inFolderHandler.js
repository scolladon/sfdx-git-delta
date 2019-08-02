"use strict";
const metadata = require("../metadata/v46")("directoryName");
const StandardHandler = require("./StandardHandler");
const path = require("path");

class InFolderHandler extends StandardHandler {
  handle() {
    if (this.handlerMap[this.changeType]) {
      this.handlerMap[this.changeType].apply(this);
    }
  }

  handleDeletion() {
    this.diffs[this.type] = this.diffs[this.type] || new Set();
    // eslint-disable-next-line no-magic-numbers
    this.diffs[this.type].add(
      this.splittedLine
        .slice(this.splittedLine.indexOf(this.type) + 1)
        .join(path.sep)
        .replace(StandardHandler.METAFILE_SUFFIX, "")
        .replace(`.${metadata[this.type].suffix}`, "")
    );
  }
}

module.exports = InFolderHandler;
