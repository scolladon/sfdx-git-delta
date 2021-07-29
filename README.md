[![NPM](https://nodei.co/npm-dl/sfdx-git-delta.png)](https://nodei.co/npm/sfdx-git-delta/) [![HitCount](http://hits.dwyl.com/scolladon/sfdx-git-delta.svg)](http://hits.dwyl.com/scolladon/sfdx-git-delta)

# SFDX-Git-Delta ![Actions Status](https://github.com/scolladon/sfdx-git-delta/workflows/CI/badge.svg) [![Maintainability](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/maintainability)](https://codeclimate.com/github/scolladon/sfdx-git-delta/maintainability) [![Test Coverage](https://api.codeclimate.com/v1/badges/95619399c7bb2cf60da4/test_coverage)](https://codeclimate.com/github/scolladon/sfdx-git-delta/test_coverage) [![Known Vulnerabilities](https://snyk.io//test/github/scolladon/sfdx-git-delta/badge.svg?targetFile=package.json)](https://snyk.io//test/github/scolladon/sfdx-git-delta?targetFile=package.json)

Generate the sfdx content in source format and destructive change from two git commits.

## TL;DR:

```sh
sfdx plugins:install sfdx-git-delta
```

```sh
sfdx sgd:source:delta --to "HEAD" --from "HEAD~1" --output "."
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

## What is SFDX-Git-Delta?

**SFDX-Git-Delta** (\*a.k.a. **SGD\***) helps Salesforce Architects and Developers accomplish 2 things with their source deployments:

1. **Make deployments faster**, by identifying the metadata that has been changed since a reference commit.
2. **Automate destructive deployments**, by listing the deleted (or renamed) metadata in a destructiveChanges.xml

To get a better understanding of what SGD is for, take a look at this post on the Salesforce Developers Blog: [Optimizing Unpackaged Deployments Using a Delta Generation Tool](https://developer.salesforce.com/blogs/2021/01/optimizing-unpackaged-deployments-using-a-delta-generation-tool.html).

![delta_principle](/img/delta_principles.png)

## Is SGD for you?

If you are not a Salesforce Architect or Developer, probably not, _sorry_.

If you are a Technical Architect or Developer, then it’s a very useful tool for you, when the 3 conditions below are met:

    Your Salesforce project uses a git repo as the source of truth.
            ➕
    You use the Source (DX) format in the repo.
            ➕
    Your metadata is not packaged (in other words, your repo contains all the unmanaged metadata of the project).

SGD is designed to be part of a CI/CD pipeline (Jenkins, Bitbucket Pipelines, GitLab CI, GitHub Actions, Azure DevOps...) that handles the deployment of the sources to the Salesforce org(s).

Pro tips: If you are in the process of building your CI/CD pipeline, make sure you already have a fully functionnal pipeline **before** implementing delta deployments (otherwise it will just make it harder to debug your pipeline). It's also important to implement a bypass in your pipeline, to have to hability to fallback to full deployment in case the delta deployement is not behaving the way you expected it.

**DISCLAIMER:**

**⚠️ SFDX-Git-Delta is NOT an officially supported tool ⚠️**

👷 Use it at your own risk, wear a helmet, and test it first before adding it to your pipeline 🔥

## How to install it?

### Option #1 (recommended) - Install as a Salesforce CLI plugin (sgd:source:delta):

You can use SGD as a Salesforce CLI plugin (`sfdx sgd:source:delta`), and this is now the recommended approach to get SGD:

```sh
sfdx plugins:install sfdx-git-delta
```

Because this plugin is not signed, you will get a warning saying that "This plugin is not digitally signed and its authenticity cannot be verified". This is expected, and you will have to answer `y` (yes) to proceed with the installation.

If you run your CI/CD jobs inside a Docker image, you can add the plugin to your image. Here is an example of a Dockerfile including the SGD plugin: https://github.com/mehdisfdc/sfdx-cli-gitlab

### Option #2 (legacy) - Install as the sgd command

Before the Salesforce CLI plugin was available, the old way to use this tool was through the `sgd` command (as described in the [old README](https://github.com/scolladon/sfdx-git-delta/blob/1093db6bd19eb48905db8f9aa5db086aa6707613/README.md)).
It is now recommended to use `sfdx sgd:source:delta`, but if you feel nostalgic about the `sgd` command, you can still get it through yarn (or npm): `yarn sfdx-git-delta@latest -g`

### Prerequisites

Git command line is required on the system where the command line is running.

**Node v14.6.0 or above is required**.
To make sure that the Salesforce CLI is using the expected node version for SGD, run `sfdx --version` before attempting to install the SGD plugin: if you see a node version below v14.6.0 in the output, you'll need to fix it first.
If you encounter this issue while having installed the correct version of node on your system, try to [install the Salesforce CLI via npm](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_install_cli.htm#sfdx_setup_install_cli_npm) (`npm install sfdx-cli --global`) rather than with another installer.

## How to use it?

<!-- commands -->

- # [`sfdx sgd:source:delta -f <string> [-t <string>] [-r <filepath>] [-i <filepath>] [-D <filepath>] [-s <filepath>] [-o <filepath>] [-a <number>] [-d] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`](#sfdx-sgdsourcedelta--f-string--t-string--r-filepath--i-filepath--d-filepath--s-filepath--o-filepath--a-number--d---json---loglevel-tracedebuginfowarnerrorfataltracedebuginfowarnerrorfatal)

## `sfdx sgd:source:delta -f <string> [-t <string>] [-r <filepath>] [-i <filepath>] [-D <filepath>] [-s <filepath>] [-o <filepath>] [-a <number>] [-d] [--json] [--loglevel trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]`

Generate the sfdx content in source format and destructive change from two git commits

```
USAGE
  $ sfdx sgd:source:delta -f <string> [-t <string>] [-r <filepath>] [-i <filepath>] [-D <filepath>] [-s <filepath>] [-o
  <filepath>] [-a <number>] [-d] [--json] [--loglevel
  trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL]

OPTIONS
  -D, --ignore-destructive=ignore-destructive                                       ignore file to use
  -a, --api-version=api-version                                                     [default: 52] salesforce API version

  -d, --generate-delta                                                              generate delta files in [--output]
                                                                                    folder

  -f, --from=from                                                                   (required) commit sha from where the
                                                                                    diff is done [git rev-list
                                                                                    --max-parents=0 HEAD]

  -i, --ignore=ignore                                                               ignore file to use

  -o, --output=output                                                               [default: ./output] source package
                                                                                    specific output

  -r, --repo=repo                                                                   [default: .] git repository location

  -s, --source=source                                                               [default: .] source folder focus
                                                                                    location related to --repo

  -t, --to=to                                                                       [default: HEAD] commit sha to where
                                                                                    the diff is done

  --json                                                                            format output as json

  --loglevel=(trace|debug|info|warn|error|fatal|TRACE|DEBUG|INFO|WARN|ERROR|FATAL)  [default: warn] logging level for
                                                                                    this command invocation
```

_See code: [src/commands/sgd/source/delta.ts](https://github.com/scolladon/sfdx-git-delta/blob/v4.8.1/src/commands/sgd/source/delta.ts)_

<!-- commandsstop -->

### Important note for Windows users:

If you run SGD on a Windows system, make sure to use double quotes [to prevent the parameters from being interpreted by the terminal](https://github.com/scolladon/sfdx-git-delta/issues/134):

## Scenario:

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
sfdx sgd:source:delta --to "HEAD" --from "HEAD~1" --output .
```

which means:

> Analyze the difference between HEAD (latest commit) and HEAD~1 (previous commit), and output the result in the current folder.

The `sfdx sgd:source:delta` command produces 2 usefull artifacts:

**1) A `package.xml` file, inside a `package` folder.** This `package.xml` file contains only the metadata that has been added and changed, and that needs to be deployed in the target org.

_Content of the `package.xml` file in our scenario:_
![package](/img/example_package.png)

**2) A `destructiveChanges.xml` file, inside a `destructiveChanges` folder.** This `destructiveChanges.xml` file contains only the metadata that has been removed or renamed, and that needs to be deleted from the target org. Note: the `destructiveChanges` folder also contains a minimal package.xml file because deploying destructive changes requires a package.xml (even an empty one) in the payload.

_Content of the `destructiveChanges.xml` file in our scenario:_
![destructiveChange](/img/example_destructiveChange.png)

In addition, we also could have generated a copy of the **force-app** folder with only the added and changed metadata, by using the `--generate-delta (-d)` option (more on that later).

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

### Diff between branches:

SGD works with any git sha pointer: commit sha, branch, tag, git expression (HEAD, etc.).

Here are 3 examples showing how you can compare the content of different branches:

**1) Comparing between commits in different branches**
For example, if you have commit `fbc3ade6` in branch `develop` and commit `61f235b1` in branch `master`:

```
sfdx sgd:source:delta --to fbc3ade6 --from 61f235b1 --output .
```

**2) Comparing branches (all changes)**
Comparing all changes between the `develop` branch and the `master` branch:

```
sfdx sgd:source:delta --to develop --from master --output .
```

**3) Comparing branches (from a common ancestor)**
Comparing changes performed in the `develop` branch since its common ancestor with the `master` branch (i.e. ignoring the changes performed in the `master` branch after `develop` was created):

```
sfdx sgd:source:delta --to develop --from $(git merge-base develop master) --output .
```

## Advanced use-cases:

### Generate a folder containing only the added/modified sources:

Using a package.xml file to deploy a subset of the metadata is propably the simpliest approach to delta deployments. But there are some situations where you may want to have the actual source files related to all the components that have been changed recently.

One example is to speed up object deployments: the package.xml approach will result on the entire sub-folder for a given object to be deployed. On the opposite, having a copy of the actual sources added/modified allows you to chirchugically deploy only the modified components.

This is where the `--generate-delta (-d)` option comes handy!

Let's use this option with our previous example:

```sh
mkdir changed-sources
sfdx sgd:source:delta --to "HEAD" --from "HEAD~1" --output changed-sources/ --generate-delta
```

In addition to the `package` and `destructiveChanges` folders, the `sfdx sgd:source:delta` command will also produce a copy of the added/changed files in the ouput folder.

_Content of the output folder when using the --generate-delta option, with the same scenario as above:_

![delta-source](/img/example_generateDelta.png)

> ⚠️ the `--generate-delta (-d)` can only be used when `--to (-t)` value is set to "HEAD" or to the "HEAD commit SHA".
> If you need to use it with `--to (-t)` pointing to another commit than "HEAD", just checkout that commit first and then use `--generate-delta (-d)`. Exemple:
>
> ```sh
> # move HEAD to past commit we are interested in
> $ git checkout <not-HEAD-commit-sha>
> # You can omit --to, it will take "HEAD" as default value
> $ sfdx sgd:source:delta --from "HEAD~1" --output changed-sources/ --generate-delta
> ```

### Exclude some metadata only from destructiveChanges.xml:

The `--ignore [-i]` parameter allows you to specify an [ignore file](https://git-scm.com/docs/gitignore) used to filter the
element on the diff to ignore. Every diff line matching the pattern from the ignore file specified in the `--ignore [-i]` will be ignored by SGD,
and will not be used to add member in `package.xml` nor `destructiveChanges.xml` (and will also be ignored when using the `--delta-generate` parameter).

But, sometimes you may need to have two different ignore policies for generating the `package.xml` and `destructiveChanges.xml` files. This is where the `--ignore-destructive [-D]` option comes handy!

Use the `--ignore-destructive` parameter to specify a dedicated ignore file to handle deletions (resulting in metadata listed in the `destructiveChanges.xml` output). In orther words, this will override the `--ignore [-i]` parameter for deleted items.

For example, consider a repository containing multiple sub-folders (force-app/main,force-app/sample, etc) and a commit deleting the Custom\_\_c object from one folder and modifying the Custom\_\_c object from another folder. This event will be treated has a Modification and a Deletion. By default, the Custom\_\_c object would appear in the `package.xml` and in `destructiveChanges.xml`, which could be a little bit inconsistent and can break the CI/CD build. This is a situation where your may want to use the `--ignore-destructive [-D]` parameter! Add the Custom\_\_c object pattern in an ignore file and pass it in the CLI parameter:

```sh
# destructiveignore
*Custom\_\_c.object-meta.xml

$ sfdx sgd:source:delta --from commit --ignore-destructive destructiveignore

```

Note that in a situation where only the `--ignore [-i]` parameter is specified (and `--ignore-destructive [-D]` is not specified), then the plugin will ignore items matching `--ignore [-i]` parameter in all situations: Addition, Modification and Deletion.

### Scoping delta generation to a specific folder

The `--source [-s]`parameter allows you to specify a folder to focus on, making any other folder ignored.
It means the delta generation will only focus on the dedicated folder.

For example, consider a repository containing multiple sub-folders (force-app/package,force-app/unpackaged, etc).
This repository contains sources deployed in a packaged (force-app/package folder) and sources deployed unpackaged (force-app/unpackaged)
You only want to apply delta generation for the unpackaged sources.

```sh
$ tree
.
├── force-app
    ├── packaged
    │    └── classes
    │        └── PackagedClass.cls
    └── unpackaged
        └── classes
            └── UnpackagedClass.cls
├── ...

# scope the delta generation only to the unpackaged folder
$ sfdx sgd:source:delta --from commit --source force-app/unpackaged
```

> The ignored patterns specified using `--ignore [-i]` and `--ignore-destructive [-D]` still apply.

### Generate a comma-separated list of the added and modified Apex classes:

Depending on your testing strategy, [you may be interested in generating a a comma-separated list of the added and modified Apex classes](https://github.com/scolladon/sfdx-git-delta/issues/126) (to use in the `sfdx force:source:deploy --testlevel RunSpecifiedTests` command, for example).

To cover this requirement, you can use a tool such as [yq](https://github.com/kislyuk/yq) to parse the content of the package.xml file produced by SGD:

`xq . < package/package.xml | jq '.Package.types | if type=="array" then .[] else . end | select(.name=="ApexClass") | .members | join(",")'`

### Use the module in your own node application

If you want to embed sgd in your node application, install it has a dependency for your application

```sh
yarn add sfdx-git-delta
```

Then use the javascript module

```js
// sample/app.js
const sgd = require('sfdx-git-delta')

const work = sgd({
  to: '', // commit sha to where the diff is done. [default : "HEAD"]
  from: '', // (required) commit sha from where the diff is done. [default : git rev-list --max-parents=0 HEAD]
  output: '', // source package specific output. [default : "./output"]
  apiVersion: '', // salesforce API version. [default : latest]
  repo: '', // git repository location. [default : "."]
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

## Authors [![Join the chat at https://gitter.im/sfdx-git-delta/community](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/sfdx-git-delta/community)

- **Sebastien Colladon** - Developer - [scolladon](https://github.com/scolladon)
- **Mehdi Cherfaoui** - Tester - [mehdisfdc](https://github.com/mehdisfdc)

## Contributing

Contributions are what make the trailblazer community such an amazing place. I regard this component as a way to inspire and learn from others. Any contributions you make are **greatly appreciated**.

See [contributing.md](/CONTRIBUTING.md) for sgd contribution principles.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
