# Publishing SFDX-Git-Delta to npm

Here are the steps to publish a version

## Prerequisites

1. Create a [github personal token](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token)
2. Use the GitHub personal token generated to set the CONVENTIONAL_GITHUB_RELEASER_TOKEN environment variable. You can use [direnv](https://direnv.net/)

## Create a new Release

```sh
$ yarn release
```

It will :

- Create a new version based on the commit types from head and package.json version
- Create the changelog with all the commit from head and the last tag version following [keepachangelog](https://keepachangelog.com/en/1.0.0/)
- Create a new commit with the generated changelog, update package.json
- Create a new tag following the semver
- Push this tag to the remote
- Trigger the new version publish
