# summary

Generate incremental package manifest and source content

# description

Use two git commit reference to generate the package corresponding to what has changed in between

# examples

- Build incremental manifest from the previous commit

<%= config.bin %> <%= command.id %> --from "origin/development" --output incremental

- Build incremental manifest and source from the development branch

<%= config.bin %> <%= command.id %> --from "origin/development" --generate-delta --output incremental

# flags.to.summary

commit sha to where the diff is done

# flags.from.summary

commit sha from where the diff is done

# flags.repo.summary

git repository location

# flags.output.summary

source package specific output

# flags.source.summary

source folder focus location related to --repo

# flags.ignore.summary

file listing paths to explicitly ignore for any diff actions

# flags.ignore-destructive.summary

file listing paths to explicitly ignore for any destructive actions

# flags.api-version.summary

salesforce metadata API version, default to sfdx-project.json "sourceApiVersion" attribute or latest version

# flags.generate-delta.summary

generate delta files in [--output] folder

# flags.ignore-whitespace.summary

ignore git diff whitespace (space, tab, eol) changes

# flags.include.summary

file listing paths to explicitly include for any diff actions

# flags.include-destructive.summary

file listing paths to explicitly include for any destructive actions