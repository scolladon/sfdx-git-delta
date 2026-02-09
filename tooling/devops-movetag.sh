#!/bin/bash

VERSION=$1
TAG=$2
OTP=$3
PACKAGE="sfdx-git-delta"

npm dist-tag add "${PACKAGE}@${VERSION}" "${TAG}" --otp "${OTP}"