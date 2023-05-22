# Contributing to SFDX-Git-Delta

We encourage the developer community to contribute to this repository. This guide has instructions to install, build, test and contribute to the framework.

- [Requirements](#requirements)
- [Installation](#installation)
- [Testing](#testing)
- [Git Workflow](#git-workflow)

## Requirements

- [Node](https://nodejs.org/) >= 14
- [yarn](https://yarnpkg.com/) >= 1.22.5
- [Code Climate](https://github.com/codeclimate/codeclimate) (If you are on MacOS, you will need Xcode Command Line Tools)
- [Docker](https://docs.docker.com/get-docker/) (Needed by Code Climate)

## Installation

### 1) Download the repository

```bash
git clone git@github.com:scolladon/sfdx-git-delta.git
```

### 2) Install Dependencies

This will install all the tools needed to contribute

```bash
yarn
```

### 3) Build application

```bash
yarn pack
```

Rebuild every time you made a change in the source and you need to test locally

## Testing

### Unit Testing sgd

When developing, use [jest](https://jestjs.io/en/) unit testing to provide test coverage for new functionality. To run the jest tests use the following command from the root directory:

```bash
# just run test
yarn test:unit

# run test with coverage details
yarn test:unit:coverage
```

To execute a particular test, use the following command:

```bash
yarn test:unit -- <path_to_test>

```

### NUT Testing sgd

When developing, use mocha testing to provide NUT functional test. To run the mocha tests use the following command from the root directory:

```bash
# run test
yarn test:nut
```

### E2E Testing sgd

SGD has E2E executed at the PR level.
Those test are located in the branch `e2e/base` and `e2e/head`
Base scenario are implemented in `e2e/base` branch
Updates to the metadata are implemented in `e2e/head`

To run the E2E test locally, clone the repository in another folder and checkout the branch `e2e/head`
Then execute:

```bash
# remove expected content
yarn clean
# run the test
sfdx sgd:source:delta --from "e2e/base" --to "e2e/head" --output "expected" -d
# check expected is back to normal
yarn test:e2e
```

Note: you may want to execute the local plugin using `node` if you have not linked the folder used to develop locally with the plugin.
```bash
node path/to/sfdx-git-delta/bin/run sgd:source:delta --from "e2e/base" --to "e2e/head" --output "expected" -d
```

## Editor Configurations

Configure your editor to use our lint and code style rules.

### Code formatting

[Prettier](https://prettier.io/) is a code formatter used to ensure consistent formatting across your code base. To use Prettier with Visual Studio Code, install [this extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) from the Visual Studio Code Marketplace.
This repository provide [.prettierignore](.prettierignore) and [.prettierrc](.prettierrc.json) files to control the behaviour of the Prettier formatter.

### Code linting

[ESLint](https://eslint.org/) is a popular JavaScript linting tool used to identify stylistic errors and erroneous constructs. This repository provide [.eslintignore](.eslintignore) file to exclude specific files from the linting process.

### Commit linting

This repository uses [Commitlint](https://github.com/conventional-changelog/commitlint) to check our commit convention.
We follow the [angular](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-angular) commit convention.
Pre-commit git hook using husky and pull request check both the commit convention for each commit in a branch.

You can use an interactive command line to help you create supported commit message

```bash
yarn commit
```
### PR linting

When a PR is ready for merge we use the PR name to create the squash and merge commit message.
We use the commit convention to auto-generate the content and the type of each release
It needs to follow our commit lint convention and it will be check at the PR level
## Git Workflow

The process of submitting a pull request is straightforward and
generally follows the same pattern each time:

1. [Fork the sfdx-git-delta repo](#fork-the-sfdx-git-delta-repo)
2. [Create a feature branch](#create-a-feature-branch)
3. [Make your changes](#make-your-changes)
4. [Rebase](#rebase)
5. [Check your submission](#check-your-submission)
6. [Create a pull request](#create-a-pull-request)
7. [Update the pull request](#update-the-pull-request)

### Fork the sfdx-git-delta repo

[Fork](https://help.github.com/en/articles/fork-a-repo) the [scolladon/sfdx-git-delta](https://github.com/scolladon/sfdx-git-delta) repo. Clone your fork in your local workspace and [configure](https://help.github.com/en/articles/configuring-a-remote-for-a-fork) your remote repository settings.

```bash
git clone git@github.com:<YOUR-USERNAME>/sfdx-git-delta.git
cd sfdx-git-delta
git remote add upstream git@github.com:scolladon/sfdx-git-delta.git
```

### Create a feature branch

```bash
git checkout main
git pull origin main
git checkout -b feature/<name-of-the-feature>
```

### Make your changes

Change the files, build, test, lint and commit your code using the following command:

```bash
git add <path/to/file/to/commit>
git commit ...
git push origin feature/<name-of-the-feature>
```

Commit your changes using a descriptive commit message

The above commands will commit the files into your feature branch. You can keep
pushing new changes into the same branch until you are ready to create a pull
request.

### Rebase

Sometimes your feature branch will get stale on the main branch,
and it will must a rebase. Do not use the github UI rebase to keep your commits signed. The following steps can help:

```bash
git checkout main
git pull upstream main
git checkout feature/<name-of-the-feature>
git rebase upstream/main
```
_note: If no conflicts arise, these commands will apply your changes on top of the main branch. Resolve any conflicts._

### Check your submission

#### Lint your changes

```bash
yarn lint
```

The above command may display lint issues not related to your changes.
The recommended way to avoid lint issues is to [configure your
editor](http://eslint.org/docs/user-guide/integrations) to warn you in real time as you edit the file.

Fixing all existing lint issues is a tedious task so please pitch in by fixing
the ones related to the files you make changes to!
#### Run tests

Test your change by running the unit tests and integration tests. Instructions [here](#testing).

### Create a pull request

If you've never created a pull request before, follow [these
instructions](https://help.github.com/articles/creating-a-pull-request/). Pull request samples [here](https://github.com/scolladon/sfdx-git-delta/pulls)

### Update the pull request

```bash
git fetch origin
git rebase origin/${base_branch}

# Then force push it
git push origin ${feature_branch} --force-with-lease
```
_note: If your pull request needs more changes, keep working on your feature branch as described above._

CI validates prettifying, linting and tests

### Collaborate on the pull request

We use [Conventional Comments](https://conventionalcomments.org/) to ensure every comment expresses the intention and is easy to understand.
Pull Request comments are not enforced, it is more a way to help the reviewers and contributors to collaborate on the pull request.

## Update Salesforce API version

The repo contains a script to increment the Salesforce API version supported by SGD.
To upgrade the API version, run the following command:

```bash
yarn && yarn increment:apiversion
```

## CLI parameters convention

The CLI uses [Apache Commons CLI](https://commons.apache.org/proper/commons-cli/index.html) parameters convention to define parameters for the CLI.
When long parameter is one word then take the first character to define the short parameter. Ex: `--word` `-w`
When long parameter is many words then take the first character of the last word to define the short parameter. Ex: `--long-phrase` `-p`
When the short parameter is already taken then put the short parameter uppercase. Ex: `--with` `-W`, `--long-paragraph` `-P`
When the character you should take for the short parameter is already taken then choose another character. Explain your choice in the PR description and let's discuss it!

## Testing the plugin from a pull request

To test SGD as a Salesforce CLI plugin from a pending pull request:

1. uninstall the previous version you may have `sfdx plugins:uninstall sfdx-git-delta`
2. clone the repository
3. change directory for the repository folder
4. checkout the branch to test
5. install the dependencies `yarn install`
6. run `yarn pack`, followed by `sfdx plugins:link`, from that local repository
7. test the plugin!