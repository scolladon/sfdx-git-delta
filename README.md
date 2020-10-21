[![NPM](https://nodei.co/npm-dl/sfdx-git-delta.png)](https://nodei.co/npm/sfdx-git-delta/) [![HitCount](http://hits.dwyl.com/scolladon/sfdx-git-delta.svg)](http://hits.dwyl.com/scolladon/sfdx-git-delta)

# SFDX-Git-Delta ![Actions Status](https://github.com/scolladon/sfdx-git-delta/workflows/CI/badge.svg) [![Maintainability](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/maintainability)](https://codeclimate.com/github/scolladon/sfdx-git-delta/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/test_coverage)](https://codeclimate.com/github/scolladon/sfdx-git-delta/test_coverage) [![Known Vulnerabilities](https://snyk.io//test/github/scolladon/sfdx-git-delta/badge.svg?targetFile=package.json)](https://snyk.io//test/github/scolladon/sfdx-git-delta?targetFile=package.json)

Generate the sfdx content in source format and destructive change from two git commits

## What is SFDX-Git-Delta?

**SFDX-Git-Delta** (\*a.k.a. **SGD\***) helps Salesforce Architects and Developers accomplish 2 things with their source deployments:

1. **Make deployments faster**, by identifying the metadata that has been changed since a reference commit.
2. **Automate destructive deployments**, by listing the deleted (or renamed) metadata in a destructivePackage.xml

## Is SGD for you?

If you are not a Salesforce Architect or Developer, probably not, _sorry_.

If you are a Technical Architect or Developer, then it’s a very useful tool for you, when the 3 conditions below are met:

        Your Salesforce project uses a git repo as the source of truth.
                ➕
        You use the Source (DX) format in the repo.
                ➕
        Your metadata is not packaged (in other words: your repo contains all the unmanaged metadata of the project).

SGD is designed to be part of a CI/CD pipeline (Jenkins, Bitbucket Pipelines, GitLab CI, GitHub Actions, Azure DevOps...) that handles the deployment of the sources to the Salesforce org(s).

Pro tips: If you are in the process of building your CI/CD pipeline, make sure you already have a fully functionnal pipeline **before** implementing delta deployments (otherwise it will just make it harder to debug your pipeline). It's also a good idea to implement a bypass in your pipeline, to have to hability to fallback to full deployment in case the delta deployement is not behaving the way you expected it.

**DISCLAIMER:**

**⚠️ SFDX-Git-Delta is NOT an officially supported tool ⚠️**

👷 Use it at your own risk, wear a helmet, and test it first before adding it to your pipeline 🔥

## How to install it?

### Option #1 (recommended) - Install as a Salesforce CLI plugin (sgd:source:delta):

You can use SGD as a Salesforce CLI plugin (`sfdx sgd:source:delta`), and this is now the recommended approach to get SGD:

```
sfdx plugins:install sfdx-git-delta
```

Because this plugin is not signed, you will get a warning saying that "This plugin is not digitally signed and its authenticity cannot be verified". This is expected, and you will have to answer `y` (yes) to proceed with the installation.

If you run your CI/CD jobs inside a Docker image, you can add the plugin to your image, such as in this example: https://hub.docker.com/r/mehdisfdc/sfdx-cli-gitlab/dockerfile

To view the full list and description of the sgd options, run `sfdx sgd:source:delta --help`

```
-t, --to [sha] commit sha to where the diff is done [HEAD] (default: "HEAD")
-f, --from [sha] commit sha from where the diff is done [git rev-list —max-parents=0 HEAD]
-o, --output [dir] source package specific output [./output] (default: "./output")
-a, --api-version [version] salesforce API version [50] (default: "50")
-i, --ignore specify the ignore file (default: ".forceignore")
-r, --repo [dir] git repository location [.] (default: ".")
-d, --generate-delta generate delta files in [./output] folder
-h, --help output usage information
```

### Option #2 (legacy) - Install as the sgd command

Before the Salesforce CLI plugin was available, the old way to use this tool was through the `sgd` command (as described in the [old README](https://github.com/scolladon/sfdx-git-delta/blob/1093db6bd19eb48905db8f9aa5db086aa6707613/README.md)).
It is now recommended to use `sfdx sgd:source:delta`, but if you feel nostalgic about the `sgd` command, you can still get it through yarn (or npm): `yarn sfdx-git-delta@latest -g`

### Prerequisites

Works in Unix like system.
Windows is not tested.

Git command line is required on the system where the command line is running.

## How to use it?

### TL;DR:

```sh
sfdx sgd:source:delta --to HEAD --from HEAD^ --output .
```

```sh
echo "--- package.xml generated with added and modified metadata ---"
cat package/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x package/package.xml
```

```sh
echo "--- destructiveChanges.xml generated with deleted metadata ---"
cat destructiveChanges/destructiveChanges.xml
echo
echo "--- Deleting removed metadata ---"
sfdx force:mdapi:deploy -d destructiveChanges --ignorewarnings
```

### Scenario:

Let’s take a look at the following scenario:

> **_The CI pipelines deploys the sources to Production anytime there is a new commit in the master branch._**

In our example, the latest commit to master is composed of:

- _Apex Class added:_ TriggerHandler
- _Apex Class added:_ TriggerHandler_Test
- _Apex Class modified:_ TestDataFactory
- _Apex Class deleted:_ AnotherTriggerFramework

![commit](/img/example_commit.png)

In this situation, we would expect the CI pipeline to:

1. **Deploy to Production only 3 classes** (no matter how much metadata is present in the force-app folder): `TriggerHandler`, `TriggerHandler_Test`, and `TestDataFactory`
2. **Delete from Production 1 classe**: `AnotherTriggerFramework`

So let’s do it!

### Run the sgd command:

From the project repo folder, the CI pipeline will run the following command:

```sh
sfdx sgd:source:delta --to HEAD --from HEAD^ --output .
```

which means:

> Analyse the difference between HEAD (latest commit) and HEAD^ (previous commit), and output the result in the current folder.

The `sfdx sgd:source:delta` command produces 2 usefull artefacts:

**1) A `package.xml` file, inside a `package` folder.** This package.xml file contains only the metadata that has been added and changed, and that needs to be deployed in the target org.

_Content of the `package.xml` file in our scenario:_
![package](/img/example_package.png)

**2) A `destructivePackage.xml` file, inside a `destructivePackage` folder.** This destructivePackage.xml file contains only the metadata that has been removed or renamed, and that needs to be deleted from the target org. Note: the `destructivePackage` folder also contains a minimal package.xml file because deploying destructive changes requires a package.xml (even an empty one) in the payload.

_Content of the `destructivePackage.xml` file in our scenario:_
![destructivePackage](/img/example_destructiveChange.png)

In addition, we could also have generated a copy of the **force-app** folder with only the added and changed metadata, by using the `--generate-delta (-d)` option (more on that later).

### Deploy only the added/modified metadata:

The CI pipeline can use the `package/package.xml` file to deploy only this subset of metadata:

```sh
echo "--- package.xml generated with added and modified metadata ---"
cat package/package.xml
echo
echo "---- Deploying added and modified metadata ----"
sfdx force:source:deploy -x package/package.xml
```

### Delete the removed metadata:

The CI pipeline can use the `destructiveChanges` folder to deploy the corresponding destructive change:

```sh
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

```sh
mkdir changed-sources
sfdx sgd:source:delta --to HEAD --from HEAD^ --output changed-sources/ --generate-delta
```

In addition to the `package` and `destructiveChanges` folders, the `sfdx sgd:source:delta` command will also produce a copy of the added/changed files in the ouput folder.

_Content of the output folder when using the --generate-delta option, with the same scenario as above:_
![delta-source](/img/example_generateDelta.png)

## Javascript Module

```js
var sgd = require('sfdx-git-delta')

const work = sgd({
  to: '', // commit sha to where the diff is done. Default : HEAD
  from: '', // commit sha from where the diff is done. Default : git rev-list --max-parents=0 HEAD
  output: '', // source package specific output. Default : ./output
  apiVersion: '', // salesforce API version. Default : 46
  repo: '', // git repository location. Default : ./repo
})

console.log(JSON.stringify(work))
/* {
 *   config: config,
 *   diffs: { package: {...}, destructiveChanges: {...} },
 *   warnings: []
 * }
 */
```

## Built With [![dependencies Status](https://david-dm.org/scolladon/sfdx-git-delta/status.svg)](https://david-dm.org/scolladon/sfdx-git-delta) [![devDependencies Status](https://david-dm.org/scolladon/sfdx-git-delta/dev-status.svg)](https://david-dm.org/scolladon/sfdx-git-delta?type=dev)

- [commander](https://github.com/tj/commander.js/) - The complete solution for node.js command-line interfaces, inspired by Ruby's commander.
- [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser) - Validate XML, Parse XML to JS/JSON and vise versa, or parse XML to Nimn rapidly without C/C++ based libraries and no callback
- [fs-extra](https://github.com/jprichardson/node-fs-extra) - Node.js: extra methods for the fs object like copy(), remove(), mkdirs().
- [ignore](https://github.com/kaelzhang/node-ignore#readme) - is a manager, filter and parser which implemented in pure JavaScript according to the .gitignore spec 2.22.1.
- [xmlbuilder](https://github.com/oozcitak/xmlbuilder-js) - An XML builder for node.js similar to java-xmlbuilder.

## Versioning

[SemVer](http://semver.org/) is used for versioning.

## Authors [![Join the chat at https://gitter.im/scolladon/sfdx-git-delta](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/dwyl/?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

- **Sebastien Colladon** - Developer - [scolladon](https://github.com/scolladon)
- **Mehdi Cherfaoui** - Tester - [mehdisfdc](https://github.com/mehdisfdc)

## Contributing

Contributions are what make the trailblazer community such an amazing place. I regard this component as a way to inspire and learn from others. Any contributions you make are **greatly appreciated**.

See [contributing.md](/CONTRIBUTING.md) for sgd contribution principles.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
