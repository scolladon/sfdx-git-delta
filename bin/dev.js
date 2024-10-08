#!/usr/bin/env -S NODE_OPTIONS="--no-warnings=ExperimentalWarning" npx ts-node --project tsconfig.json --esm
async function main() {
  const { execute } = await import('@oclif/core')
  await execute({ development: true, dir: import.meta.url })
}

await main()
