# summary

Generate incremental package manifest and source content

# description

Use two git commit reference to generate the package corresponding to what has changed in between

# examples

- Build incremental manifest from the previous commit

<%= config.bin %> <%= command.id %> --from "origin/development" --output-dir incremental

- Build incremental manifest and source from the development branch

<%= config.bin %> <%= command.id %> --from "origin/development" --generate-delta --output-dir incremental

# flags.to.summary

commit sha to where the diff is done

# flags.from.summary

commit sha from where the diff is done

# flags.repo.summary

git repository location

# flags.output.summary

source package specific output

# flags.source.summary

source folders focus location relative to --repo-dir

# flags.source.description

You can use this flag multiple times to include different folders that contain source files. Each path should be relative to --repo-dir.

The folder can exist or not.
* If the folder exists, its contents will be processed.
* If the folder doesn't exist, it usually won't show any output—unless the folder was recently deleted and is part of a diff, in which case changes may still be picked up.

Each value must be a literal repository-relative path: wildcards (`*`, `?`, `[`), git pathspec magic (`:(...)`), absolute paths, `..` and the empty string are all rejected. Matching is rooted at the repository root, so `--source-dir force-app` does not match `nested/force-app/...`.

# flags.ignore.summary

file listing paths to explicitly ignore for any diff actions

# flags.ignore-destructive.summary

file listing paths to explicitly ignore for any destructive actions

# flags.api-version.summary

salesforce metadata API version, default to sfdx-project.json "sourceApiVersion" attribute or latest version

# flags.generate-delta.summary

generate delta files in [--output-dir] folder

# flags.ignore-whitespace.summary

ignore git diff whitespace (space, tab, eol) changes

# flags.include.summary

file listing paths to explicitly include for any diff actions

# flags.include-destructive.summary

file listing paths to explicitly include for any destructive actions

# flags.additional-metadata-registry.summary

file containing additional metadata definitions to add to the registry

# flags.changes-manifest.summary

path to a JSON file grouping changed components by kind (add, modify, delete, rename); setting this flag also enables git rename detection

# error.ParameterIsNotGitSHA

--%s is not a valid sha pointer: '%s' (If in CI/CD context, check the fetch depth is properly set)

# error.PathIsNotGit

'%s' is not a git repository

# error.ChangesManifestNotAFile

--changes-manifest must point to a file path, '%s' already exists and is not a regular file

# error.ChangesManifestStatFailed

--changes-manifest: cannot inspect '%s': %s

# error.SourceDirIsEmpty

--source-dir does not accept an empty value; use '.' to scope the whole repository (received: '%s')

# error.SourceDirIsAbsolute

--source-dir must be a path relative to --repo-dir, not an absolute path (received: '%s')

# error.SourceDirEscapesRepository

--source-dir must stay within the repository; '..' segments that escape it are not allowed (received: '%s')

# error.SourceDirContainsWildcard

--source-dir does not accept wildcards (*, ?, [); repeat --source-dir once per folder, or use --include-file/--ignore-file to filter by pattern (received: '%s')

# error.SourceDirUsesPathspecMagic

--source-dir does not accept git pathspec magic (e.g. ':(exclude)', ':!'); use a literal repository-relative path instead (received: '%s')

# warning.ApiVersionOverridden

API version '%s' is not supported, using '%s' instead

# warning.ApiVersionDefaulted

No API version found (no --api-version flag, no sourceApiVersion in sfdx-project.json), using '%s'

# error.ApiVersionRetrievalFailed

Unable to resolve the Salesforce API version. Provide one with --api-version, or set "sourceApiVersion" in sfdx-project.json. Caused by: %s

# warning.MalformedXML

could not process '%s', please ensure it is properly formatted xml in both '%s' and '%s' revision

# warning.FlowDeleted

Attempt to delete the flow '%s' via destructiveChanges.xml may not work as expected (see https://github.com/scolladon/sfdx-git-delta#handle-flow-deletion)

# warning.DigitalExperienceBundleDeletion

Deleting the DigitalExperienceBundle '%s' via destructiveChanges.xml requires the related Experience site to be deactivated first for the deployment to succeed

# info.CommandIsRunning

Generating incremental package

# info.CommandSuccess

Success

# info.CommandFailure

Failure

# info.EncourageSponsorship

💡 Enjoying sfdx-git-delta?
Your contribution helps us provide fast support 🚀 and high quality features 🔥
Become a sponsor: https://github.com/sponsors/scolladon 💙