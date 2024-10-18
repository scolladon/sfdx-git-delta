---
name: Log an issue
about: Use this template for tracking new bugs.
title: '[BUG NAME]'
labels: bug
assignees: scolladon
---

Issue verification check:

- [ ] is the current repository fully deployable at the commit SHA provided with the 'from' parameter of the command?

## What is the problem?

---

<!--
  Provide a clear and concise description of what the problem is.
-->

### What is the parameter and the value you used with it?

<!--
  Provide the command and the parameters you used
  Ex: $ sgd -r . -f HEAD^
-->

### What is the expected result?

<!--
  Provide the expected output of the command
  Provide the expected content of the output folder
-->

### What is the actual result?

<!--
  Provide the actual output of the command
  Provide the actual content of the output folder
-->

## Steps to reproduce

---

<!--
  Isolate the issue and create a branch in the playground repository
  to help reproduce the actual result.
  Provide the repository url to access the reproducible state.
  Provide the sgd command to execute to reproduce.
  Ex:
  https://github.com/scolladon/sfdx-git-delta-reproduction-playground
  sgd -d -r . -f HEAD^
  sf sgd source delta -d -f HEAD^
-->

## Execution context

---

<!--
$ uname -v; npm -v ; node -v ; git --version ; sf --version ; sf plugins
-->

**Operating System:** …

**npm version:** …

**node version:** …

**git version:** …

**sf version:** …

**sgd plugin version:** …

## More information (optional)

---

<!--
  Provide the output of these commands:
  $ git diff --name-status --no-renames <from> <to>
  And for each SharingRule, WorkflowRule and CustomLabel files:
  $ git diff --no-prefix <from> <to> -- <file-path>
-->
