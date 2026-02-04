#!/bin/bash

DEV_TAG=$1

npm view sfdx-git-delta versions --json | jq -r '.[]' | grep "\\-${DEV_TAG}\\." | xargs -I {} npm deprecate "sfdx-git-delta@{}" "Deprecated dev version"
npm dist-tag rm sfdx-git-delta "${DEV_TAG}"