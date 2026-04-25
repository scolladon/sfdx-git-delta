# Contributing to SFDX-Git-Delta

We encourage the developer community to contribute to this repository. This guide has instructions to install, build, test and contribute to the framework.

- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Testing](#testing)
- [Editor Configurations](#editor-configurations)
- [Git Workflow](#git-workflow)
- [Metadata Registry](#metadata-registry)
- [Update Salesforce API version](#update-salesforce-api-version)
- [CLI parameters convention](#cli-parameters-convention)
- [Testing the plugin from a pull request](#testing-the-plugin-from-a-pull-request)
- [How to modify npm tags](#how-to-modify-npm-tags)
- [How to cleanup dev tags](#how-to-cleanup-dev-tags)

## Architecture

Before diving into the code, read [DESIGN.md](DESIGN.md) for a full architecture reference covering the pipeline stages, handler hierarchy, post-processor chain, error handling strategy, and extensibility points.

## Requirements

- [Node](https://nodejs.org/) >= 20
- [npm](https://www.npmjs.com/) >= 10

## Installation

### 1) Download the repository

```bash
git clone git@github.com:scolladon/sfdx-git-delta.git
```

### 2) Install Dependencies

This will install all the tools needed to contribute

```bash
npm install
```

### 3) Build application

```bash
npm run build
```

Rebuild every time you make a change in the source and need to test locally.

## Testing

The test suite is organised into five buckets, each backed by its own
directory and its own `npm` script. They are cumulative: a typical CI
build runs them in the order below, and `npm test` aggregates all four
non-perf buckets.

| Bucket          | Directory                                  | Vitest config                       | npm script             |
| --------------- | ------------------------------------------ | ----------------------------------- | ---------------------- |
| Unit            | `__tests__/unit/`                          | `vitest.config.ts`                  | `npm run test:unit`    |
| Integration     | `__tests__/integration/`                   | `vitest.integration.config.ts`      | `npm run test:integration` |
| NUT             | `__tests__/nut/` (`*.nut.ts`)              | `vitest.nut.config.ts`              | `npm run test:nut`     |
| Functional      | `__tests__/functional/byteEquality/`       | `vitest.functional.config.ts`       | `npm run test:functional` |
| Performance     | `__tests__/perf/`                          | `vitest.config.perf.ts`             | `npm run test:perf`    |

E2E tests live on dedicated git branches and are run separately — see the
**E2E Testing** section below.

### Unit Testing

Unit tests live in `__tests__/unit/` and are the only bucket whose vitest
config enforces 100% line / branch / function / statement coverage.

```bash
npm run test:unit
```

To run a particular file:

```bash
npm run test:unit -- <path_to_test>
```

### Integration Testing

Integration tests live in `__tests__/integration/`. They exercise broader
slices of the pipeline (e.g. SDR registry adapters, TypeHandlerFactory)
and run without coverage.

```bash
npm run test:integration
```

### NUT Testing

NUT tests (Salesforce CLI plugin testkit) live in `__tests__/nut/` as
`*.nut.ts` files. They drive the packaged CLI through the testkit
runner.

```bash
npm run test:nut
```

### Functional Testing

Functional tests live in `__tests__/functional/byteEquality/`. They
assert byte-for-byte parity of the streaming pipeline against committed
fixtures.

```bash
npm run test:functional
```

To regenerate fixtures after intentional output-format changes:

```bash
UPDATE_BYTE_EQUALITY_SNAPSHOTS=1 npm run test:functional
```

### Performance Testing

Performance benchmarks live in `__tests__/perf/`. They run through
vitest's `bench` mode and emit `perf-runtime.json` / `perf-memory.json`.

```bash
npm run test:perf
```

### E2E Testing

SGD has E2E tests executed at the PR level.
Those tests are located in the branches `e2e/base` and `e2e/head`.
Base scenarios are implemented in the `e2e/base` branch.
Updates to the metadata are implemented in `e2e/head`.

To run the E2E tests locally, clone the repository in another folder and checkout the branch `e2e/head`.
Then execute:

```bash
# remove expected content
npm run clean
# run the test
sf sgd source delta --from "e2e/base" --to "e2e/head" --output "expected" --generate-delta
# check expected is back to normal
npm run test:e2e
```

Note: you may want to execute the local plugin using `node` if you have not linked the folder used to develop locally with the plugin.

```bash
node path/to/sfdx-git-delta/bin/run sgd:source:delta --from "e2e/base" --to "e2e/head" --output "expected" -d
```

## Editor Configurations

Configure your editor to use our lint and code style rules.

### Code formatting and linting

[Biome](https://biomejs.dev/) handles both formatting and linting.

```bash
npm run lint      # check for issues
npm run lint:fix  # auto-fix issues
```

### Commit linting

This repository uses [Commitlint](https://github.com/conventional-changelog/commitlint) to check our commit convention.
We follow the [angular](https://github.com/conventional-changelog/commitlint/tree/master/@commitlint/config-angular) commit convention.
Pre-commit git hooks using husky and pull request checks both validate the commit convention for each commit in a branch.

You can use an interactive command line to help you create supported commit messages:

```bash
npm run commit
```

### PR linting

When a PR is ready for merge we use the PR name to create the squash and merge commit message.
We use the commit convention to auto-generate the content and the type of each release.
It needs to follow our commit lint convention and it will be checked at the PR level.

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

Commit your changes using a descriptive commit message.

The above commands will commit the files into your feature branch. You can keep
pushing new changes into the same branch until you are ready to create a pull
request.

### Rebase

Sometimes your feature branch will get stale on the main branch,
and it will need a rebase. Do not use the GitHub UI rebase to keep your commits signed. The following steps can help:

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
npm run lint
```

The above command may display lint issues not related to your changes.
The recommended way to avoid lint issues is to [configure your
editor](https://biomejs.dev/guides/integrate-in-vcs/) to warn you in real time as you edit the file.

The plugin lints all of the following:
- TypeScript files
- Folder structure
- Plugin parameters
- Plugin output
- Dependencies
- Dead code / configuration

Fixing all existing lint issues is a tedious task so please pitch in by fixing
the ones related to the files you make changes to!

#### Run tests

Test your change by running the unit tests and integration tests. See [testing instructions](#testing).

### Create a pull request

If you've never created a pull request before, follow [these
instructions](https://help.github.com/articles/creating-a-pull-request/). See [pull request samples](https://github.com/scolladon/sfdx-git-delta/pulls) for reference.

### Update the pull request

```bash
git fetch origin
git rebase origin/${base_branch}

# Then force push it
git push origin ${feature_branch} --force-with-lease
```

_note: If your pull request needs more changes, keep working on your feature branch as described above._

CI validates prettifying, linting and tests.

### Collaborate on the pull request

We use [Conventional Comments](https://conventionalcomments.org/) to ensure every comment expresses the intention and is easy to understand.
Pull Request comments are not enforced, it is more a way to help the reviewers and contributors to collaborate on the pull request.

## Metadata Registry

SGD uses a layered metadata registry system to know which Salesforce metadata types exist and how to handle them.

### Registry layers (by priority)

1. **Internal registry** (`src/metadata/internalRegistry.ts`) — highest priority. Contains types that need special handling (Profile children, Translations children, virtual aggregate types) and SDR gap-fillers for types not yet in SDR.
2. **SDR registry** (`@salesforce/source-deploy-retrieve`) — the Salesforce-maintained registry of metadata types.
3. **Additional metadata registry** (user-provided) — lowest priority. Users can supply extra type definitions via the `--additional-metadata-registry` flag.

### SDR gap-fillers

Some metadata types exist in Salesforce but are not yet covered by SDR. These are added to the internal registry as "gap-fillers" with `directoryName` and `suffix` fields but no special handling fields (`xmlTag`, `key`, `content`, etc.).

Gap-fillers are automatically removable: when SDR adds native support for a type, tooling detects the overlap and removes the gap-filler entry.

### Coverage check and sync tooling

A script in `tooling/` keeps the internal registry clean:

```bash
# Sync internal registry: removes auto-removable gap-fillers that SDR now covers
npm run sync:registry
```

The sync runs automatically via CI when dependabot upgrades the SDR dependency.

## Update Salesforce API version

The repo contains a script to increment the Salesforce API version supported by SGD.
To upgrade the API version, run the following command:

```bash
npm run increment:apiversion
```

## CLI parameters convention

The plugin uses [sf CLI parameters convention](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags) to define parameters for the CLI.

## Testing the plugin from a pull request

Dev builds are no longer published to the npm registry. Each open PR gets a dedicated GitHub prerelease (`dev-pr-<number>`) with a signed tarball attached, and the `dev-release` CI job posts a comment on the PR with the exact install command.

To test SGD as a Salesforce CLI plugin from a pending pull request:

1. Scroll the PR comments for the one titled `Published under dev-pr-<N> draft release.` (posted by `github-actions[bot]`).
2. Copy the command from that comment — it looks like:

   ```sh
   sf plugins install https://github.com/scolladon/sfdx-git-delta/releases/download/dev-pr-<N>/sfdx-git-delta-dev-pr-<N>.tgz
   ```

   `sf plugins install` accepts either an npm spec or a tarball URL; here we pass the URL to the prerelease asset directly.
3. Run the command. The tarball is re-uploaded on every push to the PR, so `install` again after a new commit to pick up the latest build.
4. Test the plugin!

When the PR is closed, the `cleanup` job deletes the prerelease and its tarball — any installs done against that URL need to be refreshed against a new PR.

## How to modify npm tags

Execute the npm script `npm run devops:move-tag -- <version> <tag>`
Ex: `npm run devops:move-tag -- 1.0.0 stable`

Use it to move tags to a version, for example to move `stable` and `latest` tags to a new version.
Or to downgrade `latest-rc` tag to a previous version.

## How to cleanup dev tags

Execute the npm script `npm run devops:cleanup:dev-tag -- <dev-tag> <otp>` to clean up a single dev tag.
Ex: `npm run devops:cleanup:dev-tag -- dev-101 123456`

To clean up **all** dev tags at once: `npm run devops:cleanup:dev-tag:all -- <otp>`

Both will deprecate all versions related to the dev tag(s) and remove the dist-tag(s) from the npm registry.
