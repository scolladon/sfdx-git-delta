# Publishing SFDX-Git-Delta to npm

Here are the steps to publish a version

## Update local repository with the latest version of the master branch

```sh
$ git fetch -pPt --all
$ git checkout master
$ git pull origin master
```

## Create the new version

_This will create a new tag and new draft release on github_

```sh
$ yarn version --major|--minor|--patch --message '<Release Title>'
$ git push -f origin master --tags
```

Go to gihub and finish the new release
Fill the name (select the tag created by `yarn version` <vX.X.X>)
Fill the title with the tag message value (<Release Title>)
Fill the release body following [keep a changelog](https://keepachangelog.com/en/1.0.0/) best practices
