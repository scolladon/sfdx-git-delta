/* eslint-disable max-lines-per-function */
/* eslint-disable no-undef */
/* eslint-disable no-sync */
"use strict";
const path = require("path");
const os = require("os");
const childProcess = require("child_process");
const TypeHandlerFactory = require("./service/typeHandlerFactory");
const metadata = require("./metadata/v46")("directoryName");

const UTF8_ENCODING = "utf8";

module.exports = class DiffHandler {
  constructor(config) {
    this.config = config;
  }

  diff() {
    return new Promise((resolve, reject) => {
      const fullResult = [];

      if (!this.config.from) {
        // eslint-disable-next-line array-element-newline
        const firstCommitSHARaw = childProcess.spawnSync(
          "git",
          ["rev-list", "--max-parents=0", "HEAD"],
          { cwd: this.config.repo }
        ).stdout;
        const firstCommitSHA = Buffer.from(firstCommitSHARaw);

        this.config.from = firstCommitSHA.toString(UTF8_ENCODING).trim();
      }
      // eslint-disable-next-line array-element-newline
      const child = childProcess.spawn(
        "git",
        [
          "diff",
          "--name-status",
          "--no-renames",
          this.config.from,
          this.config.to
        ],
        { cwd: this.config.repo }
      );

      // eslint-disable-next-line no-undef
      child.stdout.on("data", data =>
        fullResult.push(Buffer.from(data).toString(UTF8_ENCODING))
      );
      child.on("close", () => {
        // eslint-disable-next-line object-property-newline
        const work = { config: this.config, diffs: {}, promises: [] };
        const typeHandlerFactory = new TypeHandlerFactory(work);

        fullResult
          .join("")
          .split(os.EOL)
          .filter(line =>
            line
              .split(path.sep)
              .some(part =>
                Object.prototype.hasOwnProperty.call(metadata, part)
              )
          )
          .forEach(line => typeHandlerFactory.getTypeHander(line).handle());
        // eslint-disable-next-line no-console
        Promise.all(
          work.promises.map(promise =>
            promise.catch(err => console.warn(err.message))
          )
        ).then(() => resolve(work.diffs));
      });
      child.stderr.on("data", data => {
        // eslint-disable-next-line no-undef
        reject(Buffer.from(data).toString(UTF8_ENCODING));
      });
    });
  }
};
