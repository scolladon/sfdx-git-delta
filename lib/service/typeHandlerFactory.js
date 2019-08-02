"use strict";
const SubCustomObject = require("./subCustomObjectHandler");
const InResource = require("./inResourceHandler");
const Lightning = require("./lightningHandler");
const InFolder = require("./inFolderHandler");
const Standard = require("./standardHandler");
const metadata = require("../metadata/v46")("directoryName");
const path = require("path");

const classes = {
  aura: Lightning,
  businessProcesses: SubCustomObject,
  compactLayouts: SubCustomObject,
  dashboards: InFolder,
  documents: InFolder,
  fieldSets: SubCustomObject,
  fields: SubCustomObject,
  listViews: SubCustomObject,
  lwc: Lightning,
  recordTypes: SubCustomObject,
  reportTypes: SubCustomObject,
  reports: InFolder,
  sharingReasons: SubCustomObject,
  staticresources: InResource,
  validationRules: SubCustomObject,
  webLinks: SubCustomObject
};

module.exports = class HandlerFactory {
  constructor(work) {
    this.work = work;
  }

  getTypeHander(line) {
    const type = line.split(path.sep).reduce((acc, value) => {
      let ret = acc;

      if (Object.prototype.hasOwnProperty.call(metadata, value)) {
        ret = value;
      }

      return ret;
    }, "");

    return classes[type]
      ? new classes[type](line, type, this.work)
      : new Standard(line, type, this.work);
  }
};
