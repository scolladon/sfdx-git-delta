# sfdx-git-delta

Generate the sfdx content in source format and destructive change from two git commits

## Getting Started

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
    'apiVersion':'', // salesforce API version. Default : 46.0
    'repo':'' // git repository location. Default : ./repo
  }, console.log);
```


## Built With

* [commander](https://github.com/tj/commander.js/) - The complete solution for node.js command-line interfaces, inspired by Ruby's commander.
* [xmlbuilder](https://github.com/oozcitak/xmlbuilder-js) - An XML builder for node.js similar to java-xmlbuilder.
* [fs-extra](https://github.com/jprichardson/node-fs-extra) - Node.js: extra methods for the fs object like copy(), remove(), mkdirs().

## Versioning

[SemVer](http://semver.org/) is used for versioning.

## Authors

* **Sebastien Colladon** - *Initial work* - [scolladon](https://github.com/scolladon)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
