module.exports = {
  command:
    'Generate the sfdx content in source format and destructive change from two git commits',
  toFlag: 'commit sha to where the diff is done',
  fromFlag:
    'commit sha from where the diff is done [git rev-list --max-parents=0 HEAD]',
  repoFlag: 'git repository location',
  outputFlag: 'source package specific output',
  sourceFlag: 'source folder focus location related to --repo',
  ignoreFlag: 'ignore file to use',
  ignoreDestructiveFlag: 'ignore file to use',
  apiVersionFlag: 'salesforce API version',
  deltaFlag: 'generate delta files in [--output] folder',
  ignoreWhitespaceFlag: 'ignore git diff whitespace (space, tab, eol) changes',
}
