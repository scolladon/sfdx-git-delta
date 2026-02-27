#!/bin/bash

OTP=$1
PACKAGE="sfdx-git-delta"

DEV_TAGS=$(npm dist-tag ls "${PACKAGE}" | grep -oE '^dev-[0-9]+')

if [ -z "${DEV_TAGS}" ]; then
  echo "No dev tags found"
  exit 0
fi

VERSIONS_JSON=$(npm view "${PACKAGE}" versions --json)

for DEV_TAG in ${DEV_TAGS}; do
  echo "Cleaning up ${DEV_TAG}..."
  echo "${VERSIONS_JSON}" | jq -r '.[]' | grep "\\-${DEV_TAG}\\." | xargs -I {} npm deprecate "${PACKAGE}@{}" "Deprecated dev version" --otp "${OTP}"
  npm dist-tag rm "${PACKAGE}" "${DEV_TAG}" --otp "${OTP}"
done
