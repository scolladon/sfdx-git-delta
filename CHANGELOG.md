<!-- markdownlint-disable MD024 MD025 -->
<!-- markdown-link-check-disable -->
# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [5.22.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.21.0...v5.22.0) (2023-06-09)


### Features

* add API v58 support ([#635](https://github.com/scolladon/sfdx-git-delta/issues/635)) ([c811567](https://github.com/scolladon/sfdx-git-delta/commit/c81156776791ff8d58bac4dad2b98e3621a734f2))

## [5.21.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.20.0...v5.21.0) (2023-06-05)


### Features

* add `SlackApp` and `ViewDefinition` metadata type ([#624](https://github.com/scolladon/sfdx-git-delta/issues/624)) ([2dd9ce8](https://github.com/scolladon/sfdx-git-delta/commit/2dd9ce809d1a114008959ed0d5caec679e3eeac5))
* ignore not deletable metadata by default ([#631](https://github.com/scolladon/sfdx-git-delta/issues/631)) ([5ff3379](https://github.com/scolladon/sfdx-git-delta/commit/5ff33797d31f2d8ada30e503c6a3036d8ba57426))

## [5.20.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.19.0...v5.20.0) (2023-05-30)


### Features

* add `ActionLauncherItemDef` for `v57.0` API ([#618](https://github.com/scolladon/sfdx-git-delta/issues/618)) ([c72c708](https://github.com/scolladon/sfdx-git-delta/commit/c72c708e923f419a2f1027eddc250a067b85b6d6))


### Bug Fixes

* how `--json` parameter output is handled ([#608](https://github.com/scolladon/sfdx-git-delta/issues/608)) ([3484e31](https://github.com/scolladon/sfdx-git-delta/commit/3484e31e64d895cc3738cf3aa046afb221208afb))

## [5.19.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.18.1...v5.19.0) (2023-05-15)


### Features

* add `LoyaltyProgramSetup` metadata ([#605](https://github.com/scolladon/sfdx-git-delta/issues/605)) ([5970905](https://github.com/scolladon/sfdx-git-delta/commit/5970905779d31911267ecb68e7c4afc9ede1e334))

## [5.18.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.18.0...v5.18.1) (2023-05-11)


### Bug Fixes

* handle `ModerationRule` and `KeywordList` with shared folder type ([#594](https://github.com/scolladon/sfdx-git-delta/issues/594)) ([770b1ba](https://github.com/scolladon/sfdx-git-delta/commit/770b1bab2a3cfcbcfb84223d427ac3679e851035))

## [5.18.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.17.1...v5.18.0) (2023-04-21)


### Features

* extend metadata content pruning to more eligible types ([#533](https://github.com/scolladon/sfdx-git-delta/issues/533)) ([2576cf7](https://github.com/scolladon/sfdx-git-delta/commit/2576cf7e53f3a961b05267f11976a3146e51498a))

## [5.17.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.17.0...v5.17.1) (2023-04-04)


### Bug Fixes

* get parent folder name portability ([#562](https://github.com/scolladon/sfdx-git-delta/issues/562)) ([49b882e](https://github.com/scolladon/sfdx-git-delta/commit/49b882ee651a03e9b53d50919904f077b983fa87))

## [5.17.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.16.0...v5.17.0) (2023-04-04)


### Features

* fast `flowTranslationProcessor` exit ([#553](https://github.com/scolladon/sfdx-git-delta/issues/553)) ([2e8f9fb](https://github.com/scolladon/sfdx-git-delta/commit/2e8f9fb6be4c6b613f0b6c42bc70278c7762d358))
* process lines related to metadata entity only ([#554](https://github.com/scolladon/sfdx-git-delta/issues/554)) ([f4c5483](https://github.com/scolladon/sfdx-git-delta/commit/f4c54834461db2de6902532fdcf70369c40a2a0e))

## [5.16.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.15.0...v5.16.0) (2023-03-31)


### Features

* add FSC `AssessmentQuestion*` metadata ([#542](https://github.com/scolladon/sfdx-git-delta/issues/542)) ([afc0d9f](https://github.com/scolladon/sfdx-git-delta/commit/afc0d9fe60de35b7f173c0c86024e82dafcaa303))


### Bug Fixes

* copy empty file from git ([#547](https://github.com/scolladon/sfdx-git-delta/issues/547)) ([577f750](https://github.com/scolladon/sfdx-git-delta/commit/577f75008bca785629b2fb4ccefeab0a392573e3))

## [5.15.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.14.0...v5.15.0) (2023-03-29)


### Features

* add DecisionTable and DecisionTableDataSetLink metadata ([#538](https://github.com/scolladon/sfdx-git-delta/issues/538)) ([d91b5ae](https://github.com/scolladon/sfdx-git-delta/commit/d91b5aedf35a007136241df69f57d7ce4d19d23f))


### Bug Fixes

* keep attributes not subject to comparison ([#539](https://github.com/scolladon/sfdx-git-delta/issues/539)) ([08cf667](https://github.com/scolladon/sfdx-git-delta/commit/08cf6677b71d0b7f41d56e1ab8b437650d758dd1))

## [5.14.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.13.3...v5.14.0) (2023-03-14)


### Features

* add support for forecasting metadata types ([#518](https://github.com/scolladon/sfdx-git-delta/issues/518)) ([89d6aa7](https://github.com/scolladon/sfdx-git-delta/commit/89d6aa793c5aea6650e1dbffc7da7cf982379df8))
* implement diff detection using file content comparison ([#511](https://github.com/scolladon/sfdx-git-delta/issues/511)) ([9bf60c5](https://github.com/scolladon/sfdx-git-delta/commit/9bf60c50e30d2ba0be7f58121404c2dabd85a303))

## [5.13.3](https://github.com/scolladon/sfdx-git-delta/compare/v5.13.2...v5.13.3) (2023-02-26)


### Bug Fixes

* `fsHelper.pathExist` when path does not exist ([#482](https://github.com/scolladon/sfdx-git-delta/issues/482)) ([fef6734](https://github.com/scolladon/sfdx-git-delta/commit/fef6734c947c7811d5d6995320f996fdfd329d2a))
* flow translation post processing ([#487](https://github.com/scolladon/sfdx-git-delta/issues/487)) ([225c435](https://github.com/scolladon/sfdx-git-delta/commit/225c4356a95fc781f4fbe938d57709a7fa795a6e))
* in file comparison while ignoring whitespace ([#478](https://github.com/scolladon/sfdx-git-delta/issues/478) ([0855dcc](https://github.com/scolladon/sfdx-git-delta/commit/0855dcc5bdae8cfe47788fd3201f9a44c9b2743c))
* typos in readme ([a3459b0](https://github.com/scolladon/sfdx-git-delta/commit/a3459b0e61cee0d270a0f4c4007316a6a6b496eb))

## [5.13.2](https://github.com/scolladon/sfdx-git-delta/compare/v5.13.1...v5.13.2) (2023-02-16)


### Bug Fixes

* version output usage ([ea23411](https://github.com/scolladon/sfdx-git-delta/commit/ea23411d58ee24748f31a0309d85d2d42f4466e6))
* version output usage in release automation ([#467](https://github.com/scolladon/sfdx-git-delta/issues/467)) ([ea23411](https://github.com/scolladon/sfdx-git-delta/commit/ea23411d58ee24748f31a0309d85d2d42f4466e6))

## [5.13.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.13.0...v5.13.1) (2023-02-16)


### Bug Fixes

* remove escaping in the published release message ([#464](https://github.com/scolladon/sfdx-git-delta/issues/464)) ([9d80ccd](https://github.com/scolladon/sfdx-git-delta/commit/9d80ccd2cafeb89b17a87bb77a7c2dd0994fa191))

## [5.13.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.12.0...v5.13.0) (2023-02-16)


### Features

* add Industry Cloud metadata ([#461](https://github.com/scolladon/sfdx-git-delta/issues/461)) ([b5321db](https://github.com/scolladon/sfdx-git-delta/commit/b5321dbd4464957d92e87014225e433719fb87db))


### Bug Fixes

* commit lint dependencies issue ([#462](https://github.com/scolladon/sfdx-git-delta/issues/462)) ([aac9d5d](https://github.com/scolladon/sfdx-git-delta/commit/aac9d5d69a521f6eb386b51b53b6d6d6aa99d019))
* introduce chore commit type ([#463](https://github.com/scolladon/sfdx-git-delta/issues/463)) ([529441f](https://github.com/scolladon/sfdx-git-delta/commit/529441f875f5bf22505558e22d330e079e87f240))
* migrate to conventional ([529441f](https://github.com/scolladon/sfdx-git-delta/commit/529441f875f5bf22505558e22d330e079e87f240))
* publish to npm automation ([#454](https://github.com/scolladon/sfdx-git-delta/issues/454)) ([f50715f](https://github.com/scolladon/sfdx-git-delta/commit/f50715f405d108c41cd7cc2fa38d17d8ac952be6))

## [5.12.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.11.4...v5.12.0) (2023-02-14)


### Features

* add FSC metadata ([#444](https://github.com/scolladon/sfdx-git-delta/issues/444)) ([fcf9e02](https://github.com/scolladon/sfdx-git-delta/commit/fcf9e02f9f9733703f59cd3ec57c9ec69508f34f))
* bump Salesforce api version 57 ([#451](https://github.com/scolladon/sfdx-git-delta/issues/451)) ([2bf0737](https://github.com/scolladon/sfdx-git-delta/commit/2bf07376af15cca6595a8cf9d1a5ce0eeb32301c))
* implement `release-please` release workflow ([#442](https://github.com/scolladon/sfdx-git-delta/issues/442)) ([d79891b](https://github.com/scolladon/sfdx-git-delta/commit/d79891b5f01ad3a1b30a9e68846087b310bb0c83))


### Bug Fixes

* windows path separator with micromatch ([#448](https://github.com/scolladon/sfdx-git-delta/issues/448)) ([d49f161](https://github.com/scolladon/sfdx-git-delta/commit/d49f16199b454d2ca4dd7f20fc718ef18e0616f2))

### 5.11.4 (2023-02-01)


### Bug Fixes

* binary file copy ([#440](https://github.com/scolladon/sfdx-git-delta/issues/440)) ([b0e363a](https://github.com/scolladon/sfdx-git-delta/commit/b0e363a2bdcdb438ea651def621bd4cf03ac1782))

### 5.11.3 (2023-01-30)


### Bug Fixes

* windows path separator with git ([#436](https://github.com/scolladon/sfdx-git-delta/issues/436)) ([b760a7e](https://github.com/scolladon/sfdx-git-delta/commit/b760a7ee0381777bdd7d422d1df7f3b291cab9d2))

### 5.11.2 (2023-01-26)


### Bug Fixes

* relative `repo` and `source` parameters ([#433](https://github.com/scolladon/sfdx-git-delta/issues/433)) ([7e5409d](https://github.com/scolladon/sfdx-git-delta/commit/7e5409d94598b68a743dddd0a86d759ac31f0bde))

### 5.11.1 (2023-01-24)


### Bug Fixes

* generate incremental (`-d`) with source (`-s`) parameter ([#432](https://github.com/scolladon/sfdx-git-delta/issues/432)) ([24da138](https://github.com/scolladon/sfdx-git-delta/commit/24da1380638181ed8efcfdc8031698b53427ddcb))

## 5.11.0 (2023-01-23)


### Features

* add RelationshipGraphDefinition metadata for v55 and v56 ([#428](https://github.com/scolladon/sfdx-git-delta/issues/428)) ([de4ac84](https://github.com/scolladon/sfdx-git-delta/commit/de4ac846df690cb2d306b6508311ed7f548caf1c))

### 5.10.2 (2023-01-19)


### Bug Fixes

* experience metadata meta file suffix ([#423](https://github.com/scolladon/sfdx-git-delta/issues/423)) ([b18e388](https://github.com/scolladon/sfdx-git-delta/commit/b18e388ce4616c0e934b4c8c45bbc8d008bb94b2)), closes [#397](https://github.com/scolladon/sfdx-git-delta/issues/397)

### 5.10.1 (2023-01-17)


### Bug Fixes

* readDir git based implementation ([#419](https://github.com/scolladon/sfdx-git-delta/issues/419)) ([187cbf4](https://github.com/scolladon/sfdx-git-delta/commit/187cbf449bf46c095ca7826a0c14420449e4e4ec))

## 5.10.0 (2022-12-16)


### Features

* add flow action and knowledge publish inFile Workflow metadata ([#401](https://github.com/scolladon/sfdx-git-delta/issues/401)) ([24a32f0](https://github.com/scolladon/sfdx-git-delta/commit/24a32f01bc59b02ed7b8de051a15eb3252575c94))

## 5.9.0 (2022-12-13)


### Features

* add digital experience metadata ([#397](https://github.com/scolladon/sfdx-git-delta/issues/397)) ([71c0a02](https://github.com/scolladon/sfdx-git-delta/commit/71c0a0267e555f2139c06b1f4a74ac555fdd5a6d))

## 5.8.0 (2022-11-12)


### Features

* add `ExternalCredentials` metadata and `v56` api version ([#390](https://github.com/scolladon/sfdx-git-delta/issues/390)) ([5136b7a](https://github.com/scolladon/sfdx-git-delta/commit/5136b7a2481db2f3dfd612ecfdd6920576a4480a))

### 5.7.1 (2022-11-10)


### Bug Fixes

* ignore destructive with ignore when possible ([#388](https://github.com/scolladon/sfdx-git-delta/issues/388)) ([9c1ad91](https://github.com/scolladon/sfdx-git-delta/commit/9c1ad919eac078abf7ab2b002500ebb42d45295e))

## 5.7.0 (2022-11-04)


### Features

* improve parameters usage description ([#382](https://github.com/scolladon/sfdx-git-delta/issues/382)) ([deeb5d1](https://github.com/scolladon/sfdx-git-delta/commit/deeb5d18843a534bba5501e1c10b2143b4f0b0df))

## 5.6.0 (2022-10-24)


### Features

* new default api version definition algorithm ([#372](https://github.com/scolladon/sfdx-git-delta/issues/372)) ([e58d63a](https://github.com/scolladon/sfdx-git-delta/commit/e58d63a1d704b1b379cf30985d881cbc5fa51b5b))

### 5.5.1 (2022-10-10)

## 5.5.0 (2022-09-21)


### Features

* enable git diff on submodules ([#353](https://github.com/scolladon/sfdx-git-delta/issues/353)) ([263e37d](https://github.com/scolladon/sfdx-git-delta/commit/263e37dbc3991eae3893b330fe9856ee6b4569e9))

### [5.4.2](https://github.com/scolladon/sfdx-git-delta/compare/v5.4.1...v5.4.2) (2022-08-26)


### Bug Fixes

* handling xml parsing not returning array for one element ([#343](https://github.com/scolladon/sfdx-git-delta/issues/343)) ([c5abb9a](https://github.com/scolladon/sfdx-git-delta/commit/c5abb9af8d37d832ecc4eb2e8650c0b43020dfb6))

### [5.4.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.4.0...v5.4.1) (2022-08-26)


### Bug Fixes

* husky postinstall issue ([#336](https://github.com/scolladon/sfdx-git-delta/issues/336)) ([16b249b](https://github.com/scolladon/sfdx-git-delta/commit/16b249bed25a7b82a706f7c1cc6e8aaa4a4cf6b9))

## [5.4.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.3.1...v5.4.0) (2022-08-26)


### Features

* add big object index support ([#330](https://github.com/scolladon/sfdx-git-delta/issues/330)) ([2d2ce50](https://github.com/scolladon/sfdx-git-delta/commit/2d2ce50085188264c5b68b6972b2fc66f320d7ee))
* add customindex metadata ([#324](https://github.com/scolladon/sfdx-git-delta/issues/324)) ([2c7df3b](https://github.com/scolladon/sfdx-git-delta/commit/2c7df3bea5730625d713dae522b2ad51dc4a91b1))
* implement flow translation addition ([#322](https://github.com/scolladon/sfdx-git-delta/issues/322)) ([9a8c969](https://github.com/scolladon/sfdx-git-delta/commit/9a8c9697963a900243a701affc98b227ddacb9cf))
* support omnistudio metadata ([#333](https://github.com/scolladon/sfdx-git-delta/issues/333)) ([3fd1ee1](https://github.com/scolladon/sfdx-git-delta/commit/3fd1ee1a3a612a01687e30b0f0252d8c6af0a2ff))

### [5.3.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.3.0...v5.3.1) (2022-08-04)

## [5.3.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.2.0...v5.3.0) (2022-06-13)


### Features

* add batchCalcJobDefinitions metadata ([#312](https://github.com/scolladon/sfdx-git-delta/issues/312)) ([e770955](https://github.com/scolladon/sfdx-git-delta/commit/e770955d70fcc627d7f6488000cf7f45de4c51cb))
* add restriction rules metadata ([#309](https://github.com/scolladon/sfdx-git-delta/issues/309)) ([24a818d](https://github.com/scolladon/sfdx-git-delta/commit/24a818d954b4ea4506f9b488b0793acfbaa62516))
* introduce incremental deployment concept ([#306](https://github.com/scolladon/sfdx-git-delta/issues/306)) ([9392add](https://github.com/scolladon/sfdx-git-delta/commit/9392add66cea76d8da9e947d2c077dcdfebe5824))


### Bug Fixes

* format issue in the tsconfig ([#307](https://github.com/scolladon/sfdx-git-delta/issues/307)) ([f2ae7d2](https://github.com/scolladon/sfdx-git-delta/commit/f2ae7d2fa7d3b39b7c052d719bcb0b363e32b2b3))

## [5.2.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.1.2...v5.2.0) (2022-04-21)


### Features

* add github action linter ([#288](https://github.com/scolladon/sfdx-git-delta/issues/288)) ([9a038db](https://github.com/scolladon/sfdx-git-delta/commit/9a038db6fd7d22ab8b3ff6504018da75022272e6))
* prepare i18n ([#287](https://github.com/scolladon/sfdx-git-delta/issues/287)) ([001c07e](https://github.com/scolladon/sfdx-git-delta/commit/001c07e736584d34d75dc09005b3d701ddb33639))


### Bug Fixes

* fix typo ([#292](https://github.com/scolladon/sfdx-git-delta/issues/292)) ([0f35071](https://github.com/scolladon/sfdx-git-delta/commit/0f35071db77df9c3c6fa0390aaea69000b7e680a))
* link "Condition deployment" on TOC ([#291](https://github.com/scolladon/sfdx-git-delta/issues/291)) ([051c35a](https://github.com/scolladon/sfdx-git-delta/commit/051c35a927da3426cb51c0044b8497e229d7930a))
* wave meta file delta generation ([#293](https://github.com/scolladon/sfdx-git-delta/issues/293)) ([ceaff65](https://github.com/scolladon/sfdx-git-delta/commit/ceaff65033a7b77b8e7939f914e0d311533188e7))

### [5.1.2](https://github.com/scolladon/sfdx-git-delta/compare/v5.1.1...v5.1.2) (2022-04-04)


### Bug Fixes

* territories metadata type handling ([#277](https://github.com/scolladon/sfdx-git-delta/issues/277)) ([37488e1](https://github.com/scolladon/sfdx-git-delta/commit/37488e1b5f3d14824491e5968b288185995a81b7))

### [5.1.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.1.0...v5.1.1) (2022-03-31)


### Bug Fixes

* allow 'tag' type git pointer ([#283](https://github.com/scolladon/sfdx-git-delta/issues/283)) ([183fb4f](https://github.com/scolladon/sfdx-git-delta/commit/183fb4f2c06bde43db58e63fb78bbd7a15be3015))

## [5.1.0](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.7...v5.1.0) (2022-03-30)


### Features

* verify `--from` and `--to` parameters to be valid git pointer ([#248](https://github.com/scolladon/sfdx-git-delta/issues/248)) ([6c8accc](https://github.com/scolladon/sfdx-git-delta/commit/6c8accc8adfaaaf76c0ed298a14a3feb7de5ecd8))


### Bug Fixes

* use more robust comparison for package.xml generation ([#279](https://github.com/scolladon/sfdx-git-delta/issues/279)) ([f028375](https://github.com/scolladon/sfdx-git-delta/commit/f0283753fc0fbcfec7c242f40913515aea306466))

### [5.0.7](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.6...v5.0.7) (2022-03-29)


### Bug Fixes

* improve markdown files spelling ([#266](https://github.com/scolladon/sfdx-git-delta/issues/266)) ([02bf943](https://github.com/scolladon/sfdx-git-delta/commit/02bf943f36c45733b0bf20dbed2c045ac1107e61))
* parseLine array result destructure selection ([#281](https://github.com/scolladon/sfdx-git-delta/issues/281)) ([5a4ee7c](https://github.com/scolladon/sfdx-git-delta/commit/5a4ee7c34592720cca2f39b2716b2e92c0325634))

### [5.0.6](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.5...v5.0.6) (2022-03-24)


### Bug Fixes

* document file copy when metafile is modified ([#276](https://github.com/scolladon/sfdx-git-delta/issues/276)) ([30f972e](https://github.com/scolladon/sfdx-git-delta/commit/30f972ed1ee69eb4442e238f7bf209facd6244ef))

### [5.0.5](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.4...v5.0.5) (2022-03-23)


### Bug Fixes

* xml header displayed twice for inFile delta generated ([#274](https://github.com/scolladon/sfdx-git-delta/issues/274)) ([bf1d278](https://github.com/scolladon/sfdx-git-delta/commit/bf1d27895cd2cdbc4a66dcae73a62d3bd67c9391))

### [5.0.4](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.3...v5.0.4) (2022-03-22)


### Bug Fixes

* binary filtering for git diff --numstat parsing and document meta type file regression ([#271](https://github.com/scolladon/sfdx-git-delta/issues/271)) ([91c582c](https://github.com/scolladon/sfdx-git-delta/commit/91c582ce4a0f822b8a513558aceb856ecc8b7656))

### [5.0.3](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.2...v5.0.3) (2022-03-18)


### Bug Fixes

* ignore white space parameter `--ignore-whitespace, -W` ([#267](https://github.com/scolladon/sfdx-git-delta/issues/267)) ([d9f560e](https://github.com/scolladon/sfdx-git-delta/commit/d9f560eb1af28b749c08af4018dd626fe4720222))

### [5.0.2](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.1...v5.0.2) (2022-03-16)

### [5.0.1](https://github.com/scolladon/sfdx-git-delta/compare/v5.0.0...v5.0.1) (2022-03-16)


### Bug Fixes

* path resolution for master detail fields ([#264](https://github.com/scolladon/sfdx-git-delta/issues/264)) ([5aa12c1](https://github.com/scolladon/sfdx-git-delta/commit/5aa12c1573a79aadb3495083d217d0cbb28e24d3))

## [5.0.0](https://github.com/scolladon/sfdx-git-delta/compare/v4.12.1...v5.0.0) (2022-03-11)


### ⚠ BREAKING CHANGES

* sgd single node executable is not shipped anymore

### Features

* decommission sgd ([#221](https://github.com/scolladon/sfdx-git-delta/issues/221)) ([ecd146f](https://github.com/scolladon/sfdx-git-delta/commit/ecd146f0e6480f68bbf08362e3a535c7f0fe24ba))


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
