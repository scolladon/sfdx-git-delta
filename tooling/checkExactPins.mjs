import { readFileSync } from 'node:fs'

const exactPin = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

const { dependencies } = JSON.parse(readFileSync('package.json', 'utf-8'))

const offenders = Object.entries(dependencies).filter(
  ([, version]) => !exactPin.test(version)
)

if (offenders.length > 0) {
  const lines = offenders
    .map(([name, version]) => `  ${name}: ${version}`)
    .join('\n')
  process.stderr.write(
    `dependencies must be exact pins, found ranged values:\n${lines}\n`
  )
  process.exit(1)
}
