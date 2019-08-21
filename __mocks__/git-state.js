'use strict'
const git = jest.genMockFromModule('git-state')

git.isGitSync = () => true

module.exports = git
