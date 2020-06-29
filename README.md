[![NPM](https://nodei.co/npm/sfdx-git-delta.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/sfdx-git-delta/) [![NPM](https://nodei.co/npm-dl/sfdx-git-delta.png)](https://nodei.co/npm/sfdx-git-delta/) [![HitCount](http://hits.dwyl.com/scolladon/sfdx-git-delta.svg)](http://hits.dwyl.com/scolladon/sfdx-git-delta)

# sfdx-git-delta [![Build Status](https://travis-ci.org/scolladon/sfdx-git-delta.svg?branch=master)](https://travis-ci.org/scolladon/sfdx-git-delta) [![Maintainability](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/maintainability)](https://codeclimate.com/github/scolladon/sfdx-git-delta/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/test_coverage)](https://codeclimate.com/github/scolladon/sfdx-git-delta/test_coverage) [![Known Vulnerabilities](https://snyk.io//test/github/scolladon/sfdx-git-delta/badge.svg?targetFile=package.json)](https://snyk.io//test/github/scolladon/sfdx-git-delta?targetFile=package.json)

Generate the sfdx content in source format and destructive change from two git commits

## What is SFDX-Git-Delta? [![npm version](https://badge.fury.io/js/sfdx-git-delta.svg)](https://badge.fury.io/js/sfdx-git-delta)

**SFDX-Git-Delta** (*a.k.a. **sgd***) helps Technical Architects accomplish 2 things with their CI deployments:

1. **Make deployments faster,** by identifying the metadata that has been changed since a reference commit.
2. **Automate destructive deployments**, by listing the deleted (or renamed) metadata in a destructivePackage.xml

## Is it for you?

If you are not a Salesforce Architect or Developer, probably not, _sorry_.

If you are a Technical Architect or Developer, then it’s a very useful tool for you, when the 3 conditions below are met:

        Your Salesforce project uses a git repo as the source of truth.
                ➕
        You use the Source (DX) format in the repo.
                ➕
        You have a CI/CD pipeline (Jenkins, Bitbucket Pipelines, GitLab CI, GitHub Actions, Azure Devops...) that handles the deployment of the sources to the Salesforce org(s).

**DISCLAIMER:**

⚠️ **SFDX-Git-Delta is _not_ an officially supported tool ⚠️**

👷 Use it at your own risk, wear a helmet, and test it first before adding it to your pipeline 🔥

## How to install it?

```
npm install sfdx-git-delta@latest -g
```

If you run your CI jobs inside a Docker image (which is very common), you can add sgd to your image, such as in this example: https://hub.docker.com/r/mehdisfdc/sfdx-cli-gitlab/dockerfile

To see the full list and description of the sgd options, run `sgd --help`

```
-V, --version output the version number
-t, --to [sha] commit sha to where the diff is done [HEAD] (default: "HEAD")
-f, --from [sha] commit sha from where the diff is done [git rev-list —max-parents=0 HEAD]
-o, --output [dir] source package specific output [./output] (default: "./output")
-a, --api-version [version] salesforce API version [48] (default: "48")
-r, --repo [dir] git repository location [./repo] (default: "./repo")
-d, --generate-delta generate delta files in [./output] folder
-h, --help output usage information
```

### Prerequisites

Works in Unix like system.
Windows is not tested.

Git command line is required on the system where the command line is running.

## How to use it?

### **TLDR;**

```
sgd --to HEAD --from HEAD^ --repo . --output .
```

```
echo "--- package.xml generated with added and modified metadata ---"
cat package/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x package/package.xml
```

```
echo "--- destructiveChanges.xml generated with deleted metadata ---"
cat destructiveChanges/destructiveChanges.xml
echo
echo "--- Deleting removed metadata ---"
sfdx force:mdapi:deploy -d destructiveChanges --ignorewarnings
```

### Scenario:

Let’s take a look at the following scenario:

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

The `sgd` command produces 2 usefull artefacts:

**1) A `package.xml` file, inside a `package` folder.** This package.xml file contains only the metadata that has been added and changed, and that needs to be deployed in the target org.

_Content of the `package.xml` file in our scenario:_
![package](/img/example_package.png)

**2) A `destructivePackage.xml` file, inside a `destructivePackage` folder.** This destructivePackage.xml file contains only the metadata that has been removed or renamed, and that needs to be deleted from the target org. Note: the `destructivePackage` folder also contains a minimal package.xml file because deploying destructive changes requires a package.xml (even an empty one) in the payload.

_Content of the `destructivePackage.xml` file in our scenario:_
![destructivePackage](/img/example_destructiveChange.png)

In addition, we could also have generated a copy of the **force-app** folder with only the added and changed metadata, by using the `--generate-delta (-d)` option (more on that later).

### Deploy only the added/modified metadata:

The CI pipeline can use the `package/package.xml` file to deploy only this subset of metadata:

```
echo "--- package.xml generated with added and modified metadata ---"
cat package/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x package/package.xml
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

### Advanced use-case: Generating a folder containing only the added/modified sources

Using a package.xml file to deploy a subset of the metadata is propably the simpliest approach to delta deployments. But there are some situations where you may want to have the actual source files related to all the components that have been changed recently.

One example is to speed up object deployments: the package.xml approach will result on the entire sub-folder for a given object to be deployed. On the opposite, having a copy of the actual sources added/modified allows you to chirchugically deploy only the modified components.

This is where the `--generate-delta (-d)` option comes handy!

Let's use this option with our previous example:

```
mkdir changed-sources
sgd --to HEAD --from HEAD^ --repo . --output changed-sources/ --generate-delta
```

In addition to the `package` and `destructiveChanges` folders, the `sgd` command will also produce a copy of the added/changed files in the ouput folder.

_Content of the output folder when using the --generate-delta option, with the same scenario as above:_
![delta-source](/img/example_generateDelta.png)



## Javascript Module

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
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) - Validate XML, Parse XML to JS/JSON and vise versa, or parse XML to Nimn rapidly without C/C++ based libraries and no callback
- [fs-extra](https://github.com/jprichardson/node-fs-extra) - Node.js: extra methods for the fs object like copy(), remove(), mkdirs().
- [xmlbuilder](https://github.com/oozcitak/xmlbuilder-js) - An XML builder for node.js similar to java-xmlbuilder.

## Versioning

[SemVer](http://semver.org/) is used for versioning.

## Authors [![Join the chat at https://gitter.im/scolladon/sfdx-git-delta](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/dwyl/?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

- **Sebastien Colladon** - Developer - [scolladon](https://github.com/scolladon)
- **Mehdi Cherfaoui** - Tester - [mehdisfdc](https://github.com/mehdisfdc)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
