# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [5.0.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.0...v5.0.1) (2022-03-16)


### Bug Fixes

* path resolution for master detail fields ([#264](https://github.com/scolladon/sfdx-git-delta/issues/264)) ([5aa12c1](https://github.com/scolladon/sfdx-git-delta/commit/5aa12c1573a79aadb3495083d217d0cbb28e24d3))

## [5.0.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.12.1...v5.0.0) (2022-03-11)


### ⚠ BREAKING CHANGES

* sgd single node executable is not shipped anymore

### Features

* decommissionate sgd ([#221](https://github.com/scolladon/sfdx-git-delta/issues/221)) ([ecd146f](https://github.com/scolladon/sfdx-git-delta/commit/ecd146f0e6480f68bbf08362e3a535c7f0fe24ba))


### Bug Fixes

* pull request CI base commit ([#253](https://github.com/scolladon/sfdx-git-delta/issues/253)) ([163ee52](https://github.com/scolladon/sfdx-git-delta/commit/163ee5245ce79bbcb44323bfb249b7437d88c51c))

### [4.12.1](https://github.com/scolladon/sfdx-git-delta/compare/v4.12.0...v4.12.1) (2022-01-05)


### Bug Fixes

* spawn buffer size ([#236](https://github.com/scolladon/sfdx-git-delta/issues/236)) ([9944c43](https://github.com/scolladon/sfdx-git-delta/commit/9944c43a470c53fd3796e8d9f79f55a205695f2b))

## [4.12.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.11.0...v4.12.0) (2021-12-17)


### Features

* add WaveComponent ([#220](https://github.com/scolladon/sfdx-git-delta/issues/220)) ([bcacdaa](https://github.com/scolladon/sfdx-git-delta/commit/bcacdaaa2c65675b9afbe5e8c51886528fa43c5e))


### Bug Fixes

* implement new metadata handling for Bot ([#226](https://github.com/scolladon/sfdx-git-delta/issues/226)) ([cd8267e](https://github.com/scolladon/sfdx-git-delta/commit/cd8267e4d83219aab2746b808968b6c4c8186f5b))

## [4.11.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.10.0...v4.11.0) (2021-11-24)


### Features

* add support for defining an --include file ([#210](https://github.com/scolladon/sfdx-git-delta/issues/210)) ([a1f2738](https://github.com/scolladon/sfdx-git-delta/commit/a1f273806c91f9d8c12f8aeabc44dd5b02247736))

## [4.10.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.9.1...v4.10.0) (2021-11-15)


### Features

* add CODEOWNERS and branch protection ([#204](https://github.com/scolladon/sfdx-git-delta/issues/204)) ([07ce5d6](https://github.com/scolladon/sfdx-git-delta/commit/07ce5d67a35c2028d00fabb4500c0f2dc0a71774))
* add PlatformEventSubscriberConfig support for APIs 51 and above ([#203](https://github.com/scolladon/sfdx-git-delta/issues/203)) ([0a7a59e](https://github.com/scolladon/sfdx-git-delta/commit/0a7a59e1ddf55d1db017ac51307d6a582edb1f54))

### [4.9.1](https://github.com/scolladon/sfdx-git-delta/compare/v4.9.0...v4.9.1) (2021-10-13)


### Bug Fixes

* issue when filtering same file name for different metadata ([#196](https://github.com/scolladon/sfdx-git-delta/issues/196)) ([ca7488b](https://github.com/scolladon/sfdx-git-delta/commit/ca7488b2a4c566dec3094b9f37300ba72ccfb0e8))

## [4.9.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.8.1...v4.9.0) (2021-09-10)


### Features

* permissive git diff parameter ([#185](https://github.com/scolladon/sfdx-git-delta/issues/185)) ([6d57783](https://github.com/scolladon/sfdx-git-delta/commit/6d57783e9adb8a879f553718c862e76ccb1124b3))

### [4.8.1](https://github.com/scolladon/sfdx-git-delta/compare/v4.8.0...v4.8.1) (2021-08-04)


### Bug Fixes

* issue with inResource meta file not copied for corner cases ([#179](https://github.com/scolladon/sfdx-git-delta/issues/179)) ([909eba3](https://github.com/scolladon/sfdx-git-delta/commit/909eba3cdd685e98de435b115e1779f3a839ad6b))

## [4.8.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.7.2...v4.8.0) (2021-08-04)


### Features

* delta analysis scoped by source parameter ([#174](https://github.com/scolladon/sfdx-git-delta/issues/174)) ([62f0cf2](https://github.com/scolladon/sfdx-git-delta/commit/62f0cf2609dbbf036cece11cf0304083edede01d))


### Bug Fixes

* inResource file identification ([#178](https://github.com/scolladon/sfdx-git-delta/issues/178)) ([dda6327](https://github.com/scolladon/sfdx-git-delta/commit/dda63278aa9ca796d5ed2a1d36f17d08f1cc0a22))
* truncated xml values ([#177](https://github.com/scolladon/sfdx-git-delta/issues/177)) ([d0f99b8](https://github.com/scolladon/sfdx-git-delta/commit/d0f99b823dea9d6b43377e2974c28df797e65c22))

### [4.7.2](https://github.com/scolladon/sfdx-git-delta/compare/v4.7.1...v4.7.2) (2021-07-29)


### Bug Fixes

* wrong type detection in subfolders ([#172](https://github.com/scolladon/sfdx-git-delta/issues/172)) ([c722481](https://github.com/scolladon/sfdx-git-delta/commit/c7224818702e1b0ea72d9c7fdeb2cdb77f7f10ea))

### [4.7.1](https://github.com/scolladon/sfdx-git-delta/compare/v4.7.0...v4.7.1) (2021-07-09)


### Bug Fixes

* -d usage with -t different than HEAD ([#159](https://github.com/scolladon/sfdx-git-delta/issues/159)) ([1a5ead0](https://github.com/scolladon/sfdx-git-delta/commit/1a5ead07a12bcc52ac3a4fdf5a4a5140e05b21c2))

## [4.7.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.6.1...v4.7.0) (2021-07-06)


### Features

* add MLDomain metadata ([#157](https://github.com/scolladon/sfdx-git-delta/issues/157)) ([98af61d](https://github.com/scolladon/sfdx-git-delta/commit/98af61d2096584d5ae75618d0c677aa8aa7349e9))


### Bug Fixes

* git context to not exceed spawn sync buffer for very large inFile metadata ([#161](https://github.com/scolladon/sfdx-git-delta/issues/161)) ([21a31f8](https://github.com/scolladon/sfdx-git-delta/commit/21a31f8aecd33720623a6214e06a7d028946c418))
* handle xml parsing issues gracefully ([#158](https://github.com/scolladon/sfdx-git-delta/issues/158)) ([0fa4a49](https://github.com/scolladon/sfdx-git-delta/commit/0fa4a49388c4d65bb5e8ce7156674e1fb5b8b021))

### [4.6.1](https://github.com/scolladon/sfdx-git-delta/compare/v4.6.0...v4.6.1) (2021-06-24)


### Bug Fixes

* issue with path separator conversion in xml file and path portability ([#153](https://github.com/scolladon/sfdx-git-delta/issues/153)) ([549addf](https://github.com/scolladon/sfdx-git-delta/commit/549addf0357f4b6e6f77000210c06ed2d5fb9748))

## [4.6.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.5.0...v4.6.0) (2021-06-14)


### Features

* add configuration for Bot metadata ([#148](https://github.com/scolladon/sfdx-git-delta/issues/148)) ([fa60587](https://github.com/scolladon/sfdx-git-delta/commit/fa60587b327fdf26d65a4680f1647ddf0486de9f))
* upgrade api version to v52 ([#151](https://github.com/scolladon/sfdx-git-delta/issues/151)) ([d0c5d68](https://github.com/scolladon/sfdx-git-delta/commit/d0c5d681ec5ae7c01085721adcc8c6f0c6520b58))

## [4.5.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.4.0...v4.5.0) (2021-04-27)


### Features

* add api version 51 ([#137](https://github.com/scolladon/sfdx-git-delta/issues/137)) ([1d4fc25](https://github.com/scolladon/sfdx-git-delta/commit/1d4fc2535bae0e9b5eb2c7ecc164c64c565e2fdc))


### Bug Fixes

* document extension handling ([#136](https://github.com/scolladon/sfdx-git-delta/issues/136)) ([fea248c](https://github.com/scolladon/sfdx-git-delta/commit/fea248cb583f3ee5c3a4aeea9772a568f3e4dcaa))

## 4.4.0 (2021-04-20)


### Features

* filter deletion for case insensitive file renaming ([#133](https://github.com/scolladon/sfdx-git-delta/issues/133)) ([d8c8fbf](https://github.com/scolladon/sfdx-git-delta/commit/d8c8fbf6d279559547add2bceb38d8a799959493))

### [4.3.2](https://github.com/scolladon/sfdx-git-delta/compare/v4.3.1...v4.3.2) (2021-04-19)


### Bug Fixes

* use "/" for package member separator ([#128](https://github.com/scolladon/sfdx-git-delta/issues/128)) ([b75445a](https://github.com/scolladon/sfdx-git-delta/commit/b75445a1a1fc1707cb8e69bac36b121a9741fd75))

### [4.3.1](https://github.com/scolladon/sfdx-git-delta/compare/v4.3.0...v4.3.1) (2021-04-05)


### Bug Fixes

* silent SfdxCommand compilation issue ([#121](https://github.com/scolladon/sfdx-git-delta/issues/121)) ([d3af15a](https://github.com/scolladon/sfdx-git-delta/commit/d3af15ad509681d4209bebd22e19a8f8b38dd34d))

## [4.3.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.2.3...v4.3.0) (2021-04-04)

### Features

- **ci:** add automated release ([#116](https://github.com/scolladon/sfdx-git-delta/issues/116)) ([7da4195](https://github.com/scolladon/sfdx-git-delta/commit/7da4195672e43efbc2e578caf784e9f393a4bc07))
- **ci:** add CodeCove ([#115](https://github.com/scolladon/sfdx-git-delta/issues/115)) ([f86ff26](https://github.com/scolladon/sfdx-git-delta/commit/f86ff26183bc2730d0e30db13088d82a42834b34))
- **feat:** add --ignore-destructive parameter ([#112](https://github.com/scolladon/sfdx-git-delta/issues/112)) ([4a934b0](https://github.com/scolladon/sfdx-git-delta/commit/4a934b0d4e632469825ef4431b01947924d98480))

### Bug Fixes

- ignore reference the right files ([3082176](https://github.com/scolladon/sfdx-git-delta/commit/3082176d7540d3263dd8e5f9d94e9e96a3ce6c50))
- Custom Label Addition package.xml generation ([#114](https://github.com/scolladon/sfdx-git-delta/issues/114)) ([1447b5c](https://github.com/scolladon/sfdx-git-delta/commit/1447b5c8f968c576752a4eea63d1ac32ca881b5d))
- Make sure destructiveChanges.xml does not contains package.xml element ([#113](https://github.com/scolladon/sfdx-git-delta/issues/113)) ([9729e2f](https://github.com/scolladon/sfdx-git-delta/commit/9729e2f092ab21082f2bea151cde3701856b2477))

## [4.3.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.2.3...v4.3.0) (2021-04-04)

### Features

- **ci:** add automated release ([#116](https://github.com/scolladon/sfdx-git-delta/issues/116)) ([7da4195](https://github.com/scolladon/sfdx-git-delta/commit/7da4195672e43efbc2e578caf784e9f393a4bc07))

### Bug Fixes

- ignore reference the right files ([3082176](https://github.com/scolladon/sfdx-git-delta/commit/3082176d7540d3263dd8e5f9d94e9e96a3ce6c50))

# Changelog

Move to the sfdx plugin architecture!
`sfdx plugins:install sfdx-git-delta`
`sgd` command line is still supported

## Added

- sfdx sgd:source:delta command via sfdx plugin
- v50.0 API

## Changed

- -V parameter of `sgd` command is handled by `sfdx plugins` command
- Migrate from npm to yarn command line for development tooling
- Migrate from travis-ci to gh-actions
- -r parameter default value is now '.' instead of 'repo'
