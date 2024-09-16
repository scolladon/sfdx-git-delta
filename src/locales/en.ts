const message = {
  errorGitSHAisBlank: `--%s is blank: '%s'`,
  errorParameterIsNotGitSHA: `--%s is not a valid sha pointer: '%s' (If in CI/CD context, check the fetch depth is properly set)`,
  errorPathIsNotGit: `'%s' is not a git repository`,
  warningApiVersionNotSupported: `API version not found or not supported, using '%s' instead`,
  warningFlowDeleted: `Attempt to delete the flow '%s' via destructiveChanges.xml may not work as expected (see https://github.com/scolladon/sfdx-git-delta#handle-flow-deletion)`,
}

export default message
