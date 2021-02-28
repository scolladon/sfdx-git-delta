---
name: Log an issue
about: Use this template for tracking new bugs.
title: '[BUG NAME]'
labels: bug
assignees: scolladon
---

Issue verification check :

[] does the current repository is fully deployable at the commit sha given to the from parameter of the command ?

## What is the problem

---

<!--
  Provide a clear and concise description of what the problem is.
-->

### What is parameter and their value you used

<!--
  Provide the command you used and the parameters
  Ex : $ sgd -r . -f HEAD^
-->

### What is the expected result

<!--
  Provide the expected output of the command
  Provide the expected content of the output folder
-->

### What is the actual result

<!--
  Provide the actual output of the command
  Provide the actual content of the output folder
-->

## Steps to reproduce

---

<!--
  Isolate the issue and create a repository to reproduce the actual result
  Provide the repository url to access the reproducible state
  Provide the sgd command to execute to reproduce
  Ex :
  https://github.com/<gh-username>/<sgd-issue-reproducible-repo-name>
  sgd -d -r . -f HEAD^
-->

## Execution context

---

<!--
$ uname -v ; yarn -v ; node -v ; git --version ; sfdx --version ; sfdx plugins
-->

**Operating System:** …

**yarn version:** …

**node version:** …

**git version:** …

**sfdx version:** …

**sgd plugin version:** …

## Optional more information

---

<!--
  Provide the output of those command line :
  $ git diff --name-status --no-renames <from> <to>
  And for each SharingRule, WorkflowRule and CustomLabel files :
  $ git diff --no-prefix <from> <to> -- <file-path>
-->
