'use strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const FIXTURES_DIR = resolve(__dirname, 'fixtures')
export type Fixture = {
  name: string
  fromXml: string
  toXml: string
  expectedPath: string
  expected: string | null
  expectationPath: string
  expectationSource: string | null
}

// Absence is the only legitimate read failure: a sidecar or snapshot that
// exists but cannot be read must surface, not masquerade as missing.
const readOrNull = (path: string): string | null => {
  try {
    return readFileSync(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw error
  }
}

// Every directory under fixtures/ is a fixture: a missing from.xml or
// to.xml throws at collection instead of silently dropping the fixture,
// matching the sidecar's hard-fail contract.
export const listFixtures = (): Fixture[] =>
  readdirSync(FIXTURES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort()
    .map(name => {
      const expectedPath = join(FIXTURES_DIR, name, 'expected.xml')
      const expectationPath = join(FIXTURES_DIR, name, 'expected.json')
      return {
        name,
        fromXml: readFileSync(join(FIXTURES_DIR, name, 'from.xml'), 'utf8'),
        toXml: readFileSync(join(FIXTURES_DIR, name, 'to.xml'), 'utf8'),
        expectedPath,
        expected: readOrNull(expectedPath),
        expectationPath,
        expectationSource: readOrNull(expectationPath),
      }
    })
