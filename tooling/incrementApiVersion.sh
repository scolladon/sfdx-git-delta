#!/bin/bash

filename=`ls src/metadata/v*.json | tail -1`
version=`echo $filename | tr -d -c 0-9`
((version++))
targetname="src/metadata/v${version}.json"
\cp $filename $targetname