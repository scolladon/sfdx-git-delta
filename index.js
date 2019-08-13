'use strict'
const DiffHandler = require('./lib/diffHandler')
const PackageConstructor = require('./lib/packageConstructor')
const FileUtils = require('./lib/utils/fileUtils')

const DESTRUCTIVE_CHANGES_FILE_NAME = 'destructiveChanges.xml'
const PACKAGE_FILE_NAME = 'package.xml'
const ERROR_MESSAGE = `Not enough parameter`

const checkConfig = config =>
  typeof config.to !== 'string' ||
  typeof config.apiVersion !== 'string' ||
  typeof config.output !== 'string' ||
  typeof config.repo !== 'string'

module.exports = config => {
  return new Promise((resolve, reject) => {
    if (checkConfig(config)) {
      return reject(new Error(ERROR_MESSAGE))
    }
    const diffHandler = new DiffHandler(config)
    diffHandler
      .diff()
      .then(destructiveChangesJson =>
        Promise.all(treatPackages(destructiveChangesJson, config))
      )
      .then(() => resolve())
      .catch(err => reject(err))
  })
}

const treatPackages = (dcJson, config) => {
  const pc = new PackageConstructor(config)
  const fu = new FileUtils(config)
  return [
    pc
      .constructPackage(dcJson)
      .then(destructiveChangesContent =>
        fu.writeChangesAsync(
          destructiveChangesContent,
          DESTRUCTIVE_CHANGES_FILE_NAME
        )
      ),
    pc
      .constructPackage({})
      .then(emptyPackageContent =>
        fu.writeChangesAsync(emptyPackageContent, PACKAGE_FILE_NAME)
      ),
  ]
}
