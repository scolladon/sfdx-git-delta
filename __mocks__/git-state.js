'use strict'
const git = jest.genMockFromModule('git-state')

git.isGitSync = repo => repo !== 'not/git/folder'

module.exports = git
