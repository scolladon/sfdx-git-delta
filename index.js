'use strict';
const DiffHandler = require('./lib/diffHandler');
const PackageConstructor = require('./lib/packageConstructor');
const FileUtils = require('./lib/utils/fileUtils');

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges.xml'
const PACKAGE_FILE_NAME = 'package.xml'

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
    .then(destructiveChangesJson=>Promise.all([
      pc.constructPackage(destructiveChangesJson).then(destructiveChangesContent=>fu.writeChangesAsync(destructiveChangesContent,DESTRUCTIVE_CHANGES_FILE_NAME)),
      pc.constructPackage({}).then(emptyPackageContent=>fu.writeChangesAsync(emptyPackageContent,PACKAGE_FILE_NAME)),
    ]))
    .then(() => {
      resolve()
    })
    .catch(err=>reject(err))
  });
};