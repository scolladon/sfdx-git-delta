[![NPM](https://nodei.co/npm/sfdx-git-delta.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/sfdx-git-delta/) [![NPM](https://nodei.co/npm-dl/sfdx-git-delta.png)](https://nodei.co/npm/sfdx-git-delta/) [![HitCount](http://hits.dwyl.com/scolladon/sfdx-git-delta.svg)](http://hits.dwyl.com/scolladon/sfdx-git-delta)

# sfdx-git-delta [![Build Status](https://travis-ci.org/scolladon/sfdx-git-delta.svg?branch=master)](https://travis-ci.org/scolladon/sfdx-git-delta) [![Maintainability](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/maintainability)](https://codeclimate.com/github/scolladon/sfdx-git-delta/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/test_coverage)](https://codeclimate.com/github/scolladon/sfdx-git-delta/test_coverage) [![Known Vulnerabilities](https://snyk.io//test/github/scolladon/sfdx-git-delta/badge.svg?targetFile=package.json)](https://snyk.io//test/github/scolladon/sfdx-git-delta?targetFile=package.json)

Generate the sfdx content in source format and destructive change from two git commits

## Getting Started [![npm version](https://badge.fury.io/js/sfdx-git-delta.svg)](https://badge.fury.io/js/sfdx-git-delta)

Works in Unix like system.
Windows is not tested.

### Prerequisites

Git command line is required on the system where the command line is running.

### Installing

```
npm install -g sfdx-git-delta
```

## Usage

### Command Line

```
$ sgd -h

  Usage: sgd [options]

  Create Package.xml and destructiveChangesPre.xml from git

  Options:

    -h, --help                   output usage information
    -V, --version                output the version number
    -t, --to [sha]               commit sha to where the diff is done [HEAD]
    -f, --from [sha]             commit sha from where the diff is done [git rev-list --max-parents=0 HEAD]
    -o, --output [dir]           source package specific output [./output]
    -a, --api-version [version]  salesforce API version [46.0]
    -r, --repo [dir]             git repository location [./repo]
```

### Module

```
  var sgd = require('sfdx-git-delta');

  sgd({
    'to':'', // commit sha to where the diff is done. Default : HEAD
    'from':'', // commit sha from where the diff is done. Default : git rev-list --max-parents=0 HEAD
    'output':'', // source package specific output. Default : ./output
    'apiVersion':'', // salesforce API version. Default : 46
    'repo':'' // git repository location. Default : ./repo
  }, console.log);
```

## Built With [![dependencies Status](https://david-dm.org/scolladon/sfdx-git-delta/status.svg)](https://david-dm.org/scolladon/sfdx-git-delta) [![devDependencies Status](https://david-dm.org/scolladon/sfdx-git-delta/dev-status.svg)](https://david-dm.org/scolladon/sfdx-git-delta?type=dev)

- [commander](https://github.com/tj/commander.js/) - The complete solution for node.js command-line interfaces, inspired by Ruby's commander.
- [xmlbuilder](https://github.com/oozcitak/xmlbuilder-js) - An XML builder for node.js similar to java-xmlbuilder.
- [fs-extra](https://github.com/jprichardson/node-fs-extra) - Node.js: extra methods for the fs object like copy(), remove(), mkdirs().

## Versioning

[SemVer](http://semver.org/) is used for versioning.

## Authors [![Join the chat at https://gitter.im/scolladon/sfdx-git-delta](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/dwyl/?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

- **Sebastien Colladon** - Developer - [scolladon](https://github.com/scolladon)
- **Mehdi Cherfaoui** - Tester - [mehdisfdc](https://github.com/mehdisfdc)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
