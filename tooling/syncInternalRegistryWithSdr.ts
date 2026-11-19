#!/usr/bin/env node
// Compares the internal registry with SDR and deletes, in place, the
// gap-filler entries SDR now covers. Every other byte of the file (comments,
// field order, other entries) is left as written. Refuses (throws, writes
// nothing) when the file text cannot be matched to the module's entries.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { registry } from '@salesforce/source-deploy-retrieve'
import internalRegistry from '../src/metadata/internalRegistry.ts'
import {
  selectRemovableEntries,
  selectRetainedOverrides,
} from './internalRegistryEntries.ts'
import { removeEntries } from './internalRegistrySource.ts'

// Collect all xmlNames from SDR
const sdrXmlNames = new Set<string>()

for (const sdrType of Object.values(registry.types)) {
  sdrXmlNames.add(sdrType.name)

  if (sdrType.children?.types) {
    for (const child of Object.values(sdrType.children.types)) {
      sdrXmlNames.add(child.name)
    }
  }

  if (sdrType.folderType) {
    const folderType =
      registry.types[sdrType.folderType as keyof typeof registry.types]
    if (folderType) {
      sdrXmlNames.add(folderType.name)
    }
  }
}

const registryPath = resolve(
  import.meta.dirname ?? '.',
  '../src/metadata/internalRegistry.ts'
)
const removable = selectRemovableEntries(internalRegistry, sdrXmlNames)
const source = readFileSync(registryPath, 'utf8')
// Runs even when nothing is removable so CI validates the source mapping on every build.
const next = removeEntries(source, internalRegistry, removable)

const retained = selectRetainedOverrides(internalRegistry, sdrXmlNames)
if (retained.length > 0) {
  console.log(`\nKeeping ${retained.length} SDR-known override(s):`)
  for (const name of retained) {
    console.log(`  - ${name}`)
  }
}

if (next === source) {
  console.log('No auto-removable redundant types found. Registry is clean.')
} else {
  console.log(`\nRemoving ${removable.size} auto-removable gap-filler(s):`)
  for (const entry of internalRegistry.filter((_, i) => removable.has(i))) {
    console.log(`  - ${entry.xmlName}`)
  }
  writeFileSync(registryPath, next)
  console.log(`\nUpdated ${registryPath}`)
}
