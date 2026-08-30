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

### Dependency policy

This repository is kept aligned with its three sibling plugins (`sfdx-git-delta`,
`apex-mutation-testing`, `sf-git-merge-driver`, `dataset-loader`), so the rules below are
identical in all four.

- **Every dependency is pinned exactly** — runtime and dev alike. No `^`, no `~`, no ranges.
  A range in a runtime dependency becomes non-determinism for consumers, and a range in a dev
  dependency becomes drift between the four repositories.
- **`.npmrc` sets `save-exact=true`**, so `npm install <package>` records an exact version by
  default. This is the only mechanism enforcing the rule — keep the file. `save-exact` cannot
  be expressed in `package.json`: npm reads it from `.npmrc` or the `npm_config_save_exact`
  environment variable, and `publishConfig` applies at publish time only.
- **Pins track current latest.** Dependabot moves them; its `versioning-strategy: increase`
  raises a pinned requirement in place rather than widening it, so grouped updates stay exact.
- **npm 12 is required** (`engines.npm: ">=12"`), and **no shrinkwrap is shipped**. npm 12
  excludes `npm-shrinkwrap.json` from `npm pack` even when it is listed in `files`, silently
  and with exit 0, so the mechanism is inert rather than merely unused.
- **There is deliberately no lint for this.** `npm outdated` runs as a blocking check in CI
  and catches a pin that has fallen behind latest, but it cannot see a range that still
  resolves to latest. Adding a hand-edited range is caught in review, not by tooling.

What the pinning does and does not buy: it caps only the direct dependencies a consumer
resolves. The transitive majority still floats, and capping those would mean declaring the
whole chain directly.

### 3) Build application

```bash
npm run build
```

Rebuild every time you make a change in the source and need to test locally.

## Testing

The test suite is organized into five buckets, each backed by its own
directory and its own `npm` script. CI splits them across two build jobs:
a `quality` job runs the platform-independent gates once on ubuntu (lint,
build, unit with coverage), while a `platform` matrix job replays the
platform-sensitive buckets (integration, NUT, functional, then the E2E
suite) on every supported os (ubuntu, macos, windows) × Node (22, 24, 26)
pair. Locally, `npm test` aggregates all four non-perf buckets.

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

Functional tests live in `__tests__/functional/byteEquality/`. Each
fixture directory holds `from.xml` + `to.xml`, a hand-authored
`expected.json` sidecar, and — only when the pipeline emits a delta
file for that fixture — an `expected.xml` snapshot.

`expected.json` declares the fixture's expected `hasPackageContent`
flag and its `added` / `modified` / `deleted` manifests as
`{ type, member }` entries. It is required: a fixture without one
fails.

`expected.xml` must exist exactly when a writer fires for that
fixture. Both mismatch directions fail the test, so a stale snapshot
can never silently stop being compared, and a writer can never
silently start or stop firing unnoticed.

```bash
npm run test:functional
```

To regenerate fixtures after intentional output-format changes:

```bash
UPDATE_BYTE_EQUALITY_SNAPSHOTS=1 npm run test:functional
```

This regenerates `expected.xml` only. It never writes or repairs
`expected.json`, never bypasses the missing-sidecar failure, and never
deletes a stale snapshot — a human deletes that after reading the
failure message. A self-regenerating expectation cannot catch a wrong
`hasPackageContent`: the sidecar declares intent, the snapshot records
format, and only format is safe to regenerate.

### Performance Testing

Performance benchmarks live in `__tests__/perf/`. They run through
vitest's `bench` mode and emit `perf-runtime.json` / `perf-memory.json`.

```bash
npm run test:perf
```

### Mutation Testing

Mutation testing runs via Stryker against the unit-test bucket. The
configured thresholds are `break: 90`, `low: 90`, `high: 95`; CI fails
when the mutation score drops below 90%.

```bash
npm run test:mutation              # full run (~6 min)
npm run test:mutation:incremental  # only files changed vs origin/main
```

When a mutant survives:

- **If it is killable**, prefer adding a test assertion. The existing
  test surface intentionally avoids log-content assertions, so
  observability-only mutants on lazy `Logger.debug(...)` calls are
  documented as equivalent rather than killed via log spies.
- **If it is equivalent or unreachable in practice**, document it
  inline with `// Stryker disable next-line <Mutator,...> -- equivalent: <why>`
  (or a `// Stryker disable … // Stryker restore` block when a single
  next-line directive cannot attach — e.g. multi-line literals). Each
  rationale should reference the upstream guarantee or test fixture
  that makes the mutant unobservable.
- **Pure-constant modules** (e.g. `src/constant/libConstant.ts`) are
  excluded from `mutate` in `stryker.conf.mjs` because perTest with
  `ignoreStatic: true` cannot kill module-level const-binding mutants.
- A small set of `} catch {` / `} finally {` BlockStatement mutants
  cannot be disabled inline due to biome's brace style. They are
  enumerated in the `reporters` comment in `stryker.conf.mjs`.

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

CI validates formatting, linting and unit tests once on ubuntu (`quality`
job), and runs the platform-sensitive test buckets on an os × node matrix
(`platform` job).

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

The sync runs on every pull request in the `quality` CI job, which fails if the
script cannot run or if it leaves `internalRegistry.ts` modified. It also runs
unattended when dependabot upgrades the SDR dependency, where it gates the
`feat(metadata)` retitle and auto-merge.

## Update Salesforce API version

The repo contains a script to increment the Salesforce API version supported by SGD.
To upgrade the API version, run the following command:

```bash
npm run increment:apiversion
```

## CLI parameters convention

The plugin uses [sf CLI parameters convention](https://github.com/salesforcecli/cli/wiki/Design-Guidelines-Flags) to define parameters for the CLI.

## Testing the plugin from a pull request

Every push that changes a non-Markdown file publishes an immutable preview build to [pkg.pr.new](https://pkg.pr.new). Previews are addressed by commit, not by pull request: each such push produces a new URL, so re-read the install command instead of re-running the one from a previous commit. There is no cleanup step on close — previews are immutable and expire upstream on their own. Markdown-only pushes and Dependabot pull requests publish no preview, so the latest command may point at an earlier commit.

A preview URL sits under this repository's path but is built from the pull request's own code. Until a maintainer has reviewed that pull request, treat an installed preview as untrusted third-party code.

To test SGD as a Salesforce CLI plugin from a pending pull request:

1. Find the install command in the `github-actions[bot]` comment on the pull request.
2. Run the command — it looks like:

   ```sh
   sf plugins install https://pkg.pr.new/sfdx-git-delta@abc1234
   ```

3. Test the plugin!

The comment is posted only for pull requests from a branch of this repository. A fork's
token is read-only, so no comment is posted there — the preview is still published and the
e2e matrix still runs against it, and the URL can be read from the `preview` job's log.

