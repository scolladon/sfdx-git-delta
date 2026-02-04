'use strict'
import fs from 'node:fs'
import { execCmd } from '@salesforce/cli-plugins-testkit'
import { expect } from 'chai'
import readline from 'readline'

import { getLatestSupportedVersion } from '../../src/metadata/metadataManager.js'

describe('sgd source delta NUTS', () => {
  it('run help', () => {
    const result = execCmd('sgd source delta --help', {
      ensureExitCode: 0,
    }).shellOutput
    expect(result).to.include('incremental')
  })

  it('run `e2e` tests with multiple --source-dir flags', async () => {
    // Act
    const result = execCmd(
      'sgd source delta --from "origin/e2e/base" --to "origin/e2e/head" --output e2e/expected --generate-delta --repo e2e --source-dir test/create-classes --source-dir test/update-classes --source-dir test/delete-classes --json',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Assert
    const packageFile = fs.readFileSync(
      'e2e/expected/package/package.xml',
      'utf8'
    )
    const destructiveChangesFile = fs.readFileSync(
      'e2e/expected/destructiveChanges/destructiveChanges.xml',
      'utf8'
    )
    const version = await getLatestSupportedVersion()
    const expectedPackage = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>CreatedClass</members>
        <members>ModifiedClass</members>
        <name>ApexClass</name>
    </types>
    <version>${version}.0</version>
</Package>`
    const expectedDestructiveChanges = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>DeletedClass</members>
        <name>ApexClass</name>
    </types>
    <version>${version}.0</version>
</Package>`
    expect(packageFile).to.equal(expectedPackage)
    expect(destructiveChangesFile).to.equal(expectedDestructiveChanges)
    expect(result).to.include('"status": 0')
  })

  it('run `e2e` tests', async () => {
    // Act
    const result = execCmd(
      'sgd source delta --from "origin/e2e/base" --to "origin/e2e/head" --output e2e/expected --generate-delta --repo e2e --include e2e/.sgdinclude --include-destructive e2e/.sgdincludeDestructive --ignore e2e/.sgdignore --ignore-destructive e2e/.sgdignoreDestructive --json',
      {
        ensureExitCode: 0,
      }
    ).shellOutput

    // Assert
    const packageLineCount = await getFileLineNumber(
      'e2e/expected/package/package.xml'
    )
    const destructiveChangesLineCount = await getFileLineNumber(
      'e2e/expected/destructiveChanges/destructiveChanges.xml'
    )
    expect(packageLineCount).to.equal(235)
    expect(destructiveChangesLineCount).to.equal(140)
    expect(result).to.include('"status": 0')
  })
})

const getFileLineNumber = async (path: string) => {
  let linesCount = 0
  const rl = readline.createInterface({
    input: fs.createReadStream(path),
    output: process.stdout,
    terminal: false,
  })
  for await (const _ of rl) {
    ++linesCount
  }
  return linesCount
}
