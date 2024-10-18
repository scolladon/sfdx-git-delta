#!/bin/bash

filename=$(find src/metadata -type f -name "v*.ts" | sort | tail -1)
version=$(echo "$filename" | tr -d -c 0-9)
((version++))
\sed -i "" "s/const latestVersion: number = $((version-1))/const latestVersion: number = $version/g" src/metadata/metadataManager.ts
targetname="src/metadata/v${version}.ts"
\cp "$filename" "$targetname"
