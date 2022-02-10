# Contributing to SFDX-Git-Delta

We encourage the developer community to contribute to this repository. This guide has instructions to install, build, test and contribute to the framework.

- [Requirements](#requirements)
- [Installation](#installation)
- [Testing](#testing)
- [Git Workflow](#git-workflow)

## Requirements

- [Node](https://nodejs.org/) >= 14
- [yarn](https://yarnpkg.com/) >= 1.22.5

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

### 2) Build application

```bash
yarn pack
```

Rebuild every time you made a change in the source and you need to test locally

## Testing

### Unit Testing sgd

When developing, use [jest](https://jestjs.io/en/) unit testing to provide test coverage for new functionality. To run the jest tests use the following command from the root directory:

```bash
# just run test
yarn test

# run test with coverage details
yarn test:coverage
```

To execute a particular test, use the following command:

```bash
yarn test -- <path_to_test>
```

## Editor Configurations

Configuring your editor to use our lint and code style rules will make the code review process delightful!

### Code formatting

[Prettier](https://prettier.io/) is a code formatter used to ensure consistent formatting across your code base. To use Prettier with Visual Studio Code, install [this extension](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) from the Visual Studio Code Marketplace. The [.prettierignore](/.prettierignore) and [.prettierrc](/.prettierrc.json) files are provided as part of this repository to control the behavior of the Prettier formatter.

### Code linting

[ESLint](https://eslint.org/) is a popular JavaScript linting tool used to identify stylistic errors and erroneous constructs. The [.eslintignore](/.eslintignore) file is provided as part of this repository to exclude specific files from the linting process.

### Commit linting

[Commitlint](https://github.com/conventional-changelog/commitlint) is used to ensure commits respect our commit convention.
We follow the [angular](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-angular) commit convention.
Commit convention is enforced at pre-commit git hook using husky and at the pull request for each commit.

You can use an interactive command line to help you create supported commit message

```bash
yarn commit
```

### PR linting

PR name is used to create the squash and merge commit message when the PR is validated.
Release creation is based on the commit convention in order to auto-generate the content and the type
It needs to follow our commit lint convention and it will be check at the PR level

## Git Workflow

The process of submitting a pull request is fairly straightforward and
generally follows the same pattern each time:

1. [Fork the sfdx-git-delta repo](#fork-the-sfdx-git-delta-repo)
1. [Create a feature branch](#create-a-feature-branch)
1. [Make your changes](#make-your-changes)
1. [Rebase](#rebase)
1. [Check your submission](#check-your-submission)
1. [Create a pull request](#create-a-pull-request)
1. [Update the pull request](#update-the-pull-request)

### Fork the sfdx-git-delta repo

[Fork][fork-a-repo] the [scolladon/sfdx-git-delta](https://github.com/scolladon/sfdx-git-delta) repo. Clone your fork in your local workspace and [configure][configuring-a-remote-for-a-fork] your remote repository settings.

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

Modify the files, build, test, lint and eventually commit your code using the following command:

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

Sometimes your feature branch will get stale with respect to the main branch,
and it will require a rebase. The following steps can help:

```bash
git checkout main
git pull upstream main
git checkout feature/<name-of-the-feature>
git rebase upstream/main
```

_note: If no conflicts arise, these commands will ensure that your changes are applied on top of the main branch. Any conflicts will have to be manually resolved._

### Check your submission

#### Lint your changes

```bash
yarn lint
```

The above command may display lint issues that are unrelated to your changes.
The recommended way to avoid lint issues is to [configure your
editor][eslint-integrations] to warn you in real time as you edit the file.

Fixing all existing lint issues is a tedious task so please pitch in by fixing
the ones related to the files you make changes to!

#### Run tests

Test your change by running the unit tests and integration tests. Instructions [here](#testing).

### Create a pull request

If you've never created a pull request before, follow [these
instructions][creating-a-pull-request]. Pull request samples can be found [here](https://github.com/salesforce/sfdx-git-delta/pulls)

### Update the pull request

```sh
git fetch origin
git rebase origin/${base_branch}

# If there were no merge conflicts in the rebase
git push origin ${feature_branch}

# If there was a merge conflict that was resolved
git push origin ${feature_branch} --force
```

_note: If more changes are needed as part of the pull request, just keep committing and pushing your feature branch as described above and the pull request will automatically update._

CI validates prettifying, linting and tests

[fork-a-repo]: https://help.github.com/en/articles/fork-a-repo
[configuring-a-remote-for-a-fork]: https://help.github.com/en/articles/configuring-a-remote-for-a-fork
[setup-github-ssh]: https://help.github.com/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent/
[creating-a-pull-request]: https://help.github.com/articles/creating-a-pull-request/
[eslint-integrations]: http://eslint.org/docs/user-guide/integrations

### Collaborate on the pull request

[Conventional Comments](https://conventionalcomments.org/) is used to ensure every comment expresses the intention and is easy to understand.
Pull Request comments are not enforced, it is more a way to help the reviewers and contributors to collaborate on the pull request.

## Update Salesforce API version

The repo contains a script to increment the Salesforce API version supported by SGD.
To upgrade the API version, run the following command:

```
yarn && yarn increment:apiversion
```

## CLI parameters convention

[Apache Commons CLI](https://commons.apache.org/proper/commons-cli/index.html) parameters convention is used to define parameters for the CLI.
When long parameter is one word then take the first character to define the short parameter. Ex: `--word` `-w`
When long parameter is multiple words then take the first character of the last word to define the short parameter. Ex: `--long-phrase` `-p`
When the short parameter is already taken then put the short parameter uppercase. Ex: `--with` `-W`, `--long-paragraph` `-P`
When the character you should take following the rule above for the short parameter is already taken then choose another character, explain your choice in the PR description and let's discuss it!

## Testing the plugin from a pull request

To test SGD as a Salesforce CLI plugin from a pending pull request:

1. uninstall the previous version you may have `sfdx plugins:uninstall sfdx-git-delta`
2. clone the repository
3. checkout the branch to test
4. run `yarn pack`, followed by `sfdx plugins:link`, from that local repository
5. test the plugin!
