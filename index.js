'use strict';
const DiffHandler = require('./lib/diffHandler');
const PackageConstructor = require('./lib/packageConstructor');
const FileUtils = require('./lib/utils/fileUtils');

module.exports = (config) => {

  return new Promise((resolve, reject) => {

    if(typeof config.to === 'undefined'
    || typeof config.from === 'undefined'
    || typeof config.apiVersion === 'undefined'
    || typeof config.output === 'undefined'
    || typeof config.repo === 'undefined') {
      return reject('Not enough config options');
    }
    

    const diffHandler = new DiffHandler(config);
    const pc = new PackageConstructor(config);
    const fu = new FileUtils(config);

    diffHandler.diff()
    .then(destructiveChangesContent=>pc.constructPackage(destructiveChangesContent))
    .then(destructiveChangesContent=>fu.writeDestructiveChangesAsync(destructiveChangesContent))
    .then(() => {
      resolve()
    })
    .catch(err=>reject(err))
  });
};