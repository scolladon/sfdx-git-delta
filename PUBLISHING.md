# Publishing SFDX-Git-Delta to npm

Here are the steps to publish a version

## Prerequisites

1. Create a [github personal token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)
2. Use the GitHub personal token generated to set the CONVENTIONAL_GITHUB_RELEASER_TOKEN environment variable. You can use [direnv](https://direnv.net/)

## Create a new Release

```sh
$ yarn release
$ yarn publish --access public --tag "latest-rc"
```

This will:

- Create a new version based on the commit types from head and package.json version
- Create a changelog with all the commit from head and the last tag version following [keepachangelog](https://keepachangelog.com/en/1.0.0/)
- Create a new commit with the generated changelog, update package.json
- Create a new tag following the semver
- Push this tag to the remote
- Trigger the new version publish

You can use the "Release latest-rc" manual github action to publish the last commit on main as the `latest-rc` version

## Update tag version

```sh
$ yarn npm tag add sfdx-git-delta@<version-source> <version-target> 
```

It will set the version-source release channel to the version-target.

**Update `latest` to be `latest-rc`:**
This will update the SGD version most users get. The `latest` version is the one installed by default with the `sfdx plugins:install sfdx-git-delta` command.
```sh
$ yarn npm tag add sfdx-git-delta@latest-rc latest
```

**Update `stable` to be `latest`:**
To be performed once the current `latest` version is considered stable enough.
```sh
$ yarn npm tag add sfdx-git-delta@latest stable
```

**Rollback**: 
Use this command only if something is wrong with the current `latest` version, and you need to roll it back to a previous version (to `v5.0.0` in this example).
```sh
$ yarn npm tag add sfdx-git-delta@v5.0.0 latest
```

You can use the "Manage Versions" manual github action to do the same thing.