import { readFileSync } from 'node:fs'

// Bare semver only: optional prerelease then optional build metadata, either
// or both. Anything carrying range syntax, a dist-tag or a protocol
// (npm:, file:, workspace:, git+https:, ...) fails it.
const exactPin = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/

const manifestPath = 'package.json'
const { dependencies } = JSON.parse(readFileSync(manifestPath, 'utf-8'))

// Refuse to pass vacuously: an absent or empty `dependencies` would otherwise
// report zero offenders and exit 0, silently retiring the policy this gate
// exists to enforce.
if (!dependencies || Object.keys(dependencies).length === 0) {
  process.stderr.write(
    `${manifestPath} declares no dependencies - refusing to pass vacuously\n`
  )
  process.exit(1)
}

const entries = Object.entries(dependencies)
const offenders = entries.filter(([, version]) => !exactPin.test(version))

if (offenders.length > 0) {
  const lines = offenders
    .map(([name, version]) => `  ${name}: ${version}`)
    .join('\n')
  process.stderr.write(
    `dependencies must be exact versions, found non-exact values:\n${lines}\n`
  )
  process.exit(1)
}

process.stdout.write(`${entries.length} runtime dependencies are exact pins\n`)
