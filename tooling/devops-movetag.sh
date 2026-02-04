#!/bin/bash

VERSION=$1
TAG=$2

npm dist-tag add "sfdx-git-delta@${VERSION}" "${TAG}"