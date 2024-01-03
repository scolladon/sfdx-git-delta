const message = {
  errorGitSHAisBlank: `--%s is blank: '%s'`,
  errorParameterIsNotGitSHA: `--%s is not a valid sha pointer: '%s' (If in CI/CD context, check the fetch depth is properly set)`,
  errorPathIsNotDir: `'%s' folder does not exist`,
  errorPathIsNotFile: `'%s' file does not exist`,
  errorPathIsNotGit: `'%s' is not a git repository`,
  warningApiVersionNotSupported: `API version not found or not supported, using '%s' instead`,
}

export default message
