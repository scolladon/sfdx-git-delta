#!/bin/bash

filename=`find src/metadata -type f -name "v*.json" | sort | tail -1`
version=`echo "$filename" | tr -d -c 0-9`
((version++))
targetname="src/metadata/v${version}.json"
\cp "$filename" "$targetname"