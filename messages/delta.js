module.exports = {
  command:
    'Generate the sfdx content in source format and destructive change from two git commits',
  toFlag: 'commit sha to where the diff is done',
  fromFlag:
    'commit sha from where the diff is done [git rev-list --max-parents=0 HEAD]',
  repoFlag: 'git repository location',
  outputFlag: 'source package specific output',
  sourceFlag: 'source folder focus location related to --repo',
  ignoreFlag: 'file listing paths to explicitly ignore for any diff actions',
  ignoreDestructiveFlag:
    'file listing paths to explicitly ignore for any destructive actions',
  apiVersionFlag:
    'salesforce metadata API version, default to sfdx-project.json "sourceApiVersion" attribut or latest version',
  deltaFlag: 'generate delta files in [--output] folder',
  ignoreWhitespaceFlag: 'ignore git diff whitespace (space, tab, eol) changes',
  includeFlag: 'file listing paths to explicitly include for any diff actions',
  includeDestructiveFlag:
    'file listing paths to explicitly include for any destructive actions',
}
