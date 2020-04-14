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


## What is SFDX-Git-Delta?

**SFDX-Git-Delta** (*a.k.a. **sgd***) helps Technical Architects accomplish 2 things with their CI deployments:

1. **Make deployments faster,** by identifying the metadata that has been changed since a reference commit.
2. **Automate destructive deployments**, by listing the deleted (or renamed) metadata in a destructivePackage.xml

## Is it for me?

If you are not a Salesforce Architect, probably not, _sorry_.

If you are a Technical Architect, then it’s a very useful tool for you, _when the 3 conditions below are met:_

        Your Salesforce project uses a git repo as the source of truth.
                ➕
        You use the new **Source (DX) format in the repo.
                ➕
        You have a CI/CD pipeline (Jenkins, Bitbucket Pipelines, GitLab CI...) that handles the deployment of the sources to the salesforce org(s).


**DISCLAIMER:**

⚠️ **SFDX-Git-Delta is _not_ an officially supported tool ⚠️**

👷 Use it at your own risk, wear a helmet, and do not let non-technical people play with it 🔥


## How to use it?

### **TLDR;**

```
sgd --to HEAD --from HEAD^ --repo . --output .
```

```
echo "--- package.xml generated with added and modified metadata ---"
cat packages/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x packages/package.xml
```

```
echo "--- destructiveChanges.xml generated with deleted metadata ---"
cat destructiveChanges/destructiveChanges.xml
echo
echo "--- Deleting removed metadata ---"     
sfdx force:mdapi:deploy -d destructiveChanges --ignorewarnings
```



### Scenario:

Let’s take to following scenario: 

> ***The CI pipelines deploys the sources to Production anytime there is a new commit in the master branch.***


In our example, the latest commit to master is composed of:
+ _Apex Class added:_ TriggerHandler
+ _Apex Class added:_ TriggerHandler_Test
+ _Apex Class modified:_ TestDataFactory
+ _Apex Class deleted:_ AnotherTriggerFramework

![commit](/img/example_commit.png)

In this situation, we would expect the CI pipeline to:

1. **Deploy to Production only 3 classes** (no matter how much metadata is present in the force-app folder): TriggerHandler; TriggerHandler_Test; TestDataFactory
2. **Delete from Production 1 classe**: AnotherTriggerFramework

So let’s do it!


### Run the sgd command:

From the project repo folder, the CI pipeline will run the following command

```
sgd --to HEAD --from HEAD^ --repo . --output .
```

which means:

> Analyse the difference between HEAD (latest commit) and HEAD^ (previous commit), from the current folder, and output the result in the same folder.


_This will generate 2 very usefull artefacts :_

**1) A `package.xml` file, inside a `package` folder.** This package.xml file contains only the metadata that has been added and changed, and that needs to be deployed in the target org.

*Content of the `package.xml` file in our scenario:*
![package](/img/example_package.png)

**2) A `destructivePackage.xml` file, inside a `destructivePackage` folder.** This destructivePackage.xml file contains only the metadata that has been removed or renamed, and that needs to be deleted from the target org.

*Content of the `destructivePackage.xml` file in our scenario:*
![destructivePackage](/img/example_destructiveChange.png)

If needed, we could also have generated a copy of the force-app folder with only the added and changed metadata, by using the `--generate-delta` option. Run `sgd --help` to review all the options that `sgd` accepts.



### Deploy only the added/modified metadata:

The CI pipeline can use the `package/package.xml` file to deploy only this subset of metadata:

```
echo "--- package.xml generated with added and modified metadata ---"
cat packages/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x packages/package.xml
```



### Delete the removed metadata:

The CI pipeline can use the `destructiveChanges` folder to deploy the corresponding destructive change:

```
echo "--- destructiveChanges.xml generated with deleted metadata ---"
cat destructiveChanges/destructiveChanges.xml
echo
echo "--- Deleting removed metadata ---"     
sfdx force:mdapi:deploy -d destructiveChanges --ignorewarnings
```


And voilà! 🥳



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