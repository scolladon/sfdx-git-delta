"use strict";
const DiffHandler = require("./lib/diffHandler");
const PackageConstructor = require("./lib/packageConstructor");
const FileUtils = require("./lib/utils/fileUtils");

const DESTRUCTIVE_CHANGES_FILE_NAME = "destructiveChanges.xml";
const PACKAGE_FILE_NAME = "package.xml";

module.exports = config => {
  return new Promise((resolve, reject) => {
    if (
      typeof config.to !== "string" ||
      typeof config.from !== "string" ||
      typeof config.apiVersion !== "string" ||
      typeof config.output !== "string" ||
      typeof config.repo !== "string"
    ) {
      return reject(
        new Error(
          `Not enough parameter. Execute -h to better understand how to execute`
        )
      );
    }

    const diffHandler = new DiffHandler(config);
    const pc = new PackageConstructor(config);
    const fu = new FileUtils(config);

    diffHandler
      .diff()
      .then(destructiveChangesJson =>
        Promise.all([
          pc
            .constructPackage(destructiveChangesJson)
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
            )
        ])
      )
      .then(() => resolve())
      .catch(err => reject(err));
  });
};
