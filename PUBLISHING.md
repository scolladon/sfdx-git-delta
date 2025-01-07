# Publishing SFDX-Git-Delta to npm

Here are the steps to publish a version

## Release

This repository uses [release-please](https://github.com/googleapis/release-please-action) workflow.

Merge the release pull request to create a new version, it will take care of:
- defining next version number
- updating `package.json` version attribute
- create the changelog
- create a tag version
- create a github release
- publish to npm the new version
- set `latest-rc` npm channel to point the new version

## Update tag version

```sh
npm dist-tag add sfdx-git-delta@<version-source> <version-target>
```

It will set the `version-source` release channel to the `version-target` specific release (`vX.Y.Z`).

**Update `v5.6.0` to be `latest`:**
To be performed once the current `latest-rc` version (`v5.6.0` at that time) is considered stable enough. The `latest` version is the one installed by default with the `sf plugins install sfdx-git-delta` command.
```sh
npm dist-tag add sfdx-git-delta@v5.6.0 latest
```

**Update `v5.5.0` to be `stable`:**
To be performed once the current `latest` version (`v.5.5.0` at that time) is considered stable enough.
```sh
npm dist-tag add sfdx-git-delta@v5.5.0 stable
```

**Rollback**:
Use this command only if something is wrong with the current `latest` version, and you need to roll it back to a previous version (to `v5.0.0` in this example).
```sh
npm dist-tag add sfdx-git-delta@v5.0.0 latest
```

Use the **"Manage Versions"** manual github action to do the same thing with point & click

## Deprecate version expression

```sh
npm deprecate sfdx-git-delta@<version-expression> "<message>"
```

It will deprecate the `version-expression` with the `message`.
The `version-expression` can either be a specific version (`vX.Y.Z`)
Or a [version range](https://semver.npmjs.com/)

Do not specify a `message` ("") to un-deprecate a version expression
```sh
npm deprecate sfdx-git-delta@<version-expression> ""
```

Use the **"Deprecate Versions"** manual github action to do the same thing with point & click
