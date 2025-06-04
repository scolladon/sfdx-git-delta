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

# error.ParameterIsNotGitSHA

--%s is not a valid sha pointer: '%s' (If in CI/CD context, check the fetch depth is properly set)

# error.PathIsNotGit

'%s' is not a git repository

# warning.ApiVersionNotSupported

API version not found or not supported, using '%s' instead

# warning.FlowDeleted

Attempt to delete the flow '%s' via destructiveChanges.xml may not work as expected (see https://github.com/scolladon/sfdx-git-delta#handle-flow-deletion)
 
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