import { readFileSync, writeFileSync } from 'node:fs'

const inputPath = 'perf-raw.json'
const runtimeOutputPath = 'perf-runtime.json'
const memoryOutputPath = 'perf-memory.json'

const raw = JSON.parse(readFileSync(inputPath, 'utf-8'))

const benchmarks = []

for (const file of raw.files || []) {
  for (const group of file.groups || []) {
    for (const b of group.benchmarks || []) {
      benchmarks.push(b)
    }
  }
}

const runtimeEntries = benchmarks.map(b => ({
  name: b.name,
  unit: 'ops/sec',
  value: Math.round(b.hz),
  range: `±${b.rme.toFixed(2)}%`,
}))

const memoryEntries = benchmarks.map(b => ({
  name: b.name,
  unit: 'ms',
  value: Number(b.mean.toFixed(4)),
  range: `±${b.rme.toFixed(2)}%`,
}))

writeFileSync(runtimeOutputPath, JSON.stringify(runtimeEntries, null, 2))
writeFileSync(memoryOutputPath, JSON.stringify(memoryEntries, null, 2))

// biome-ignore lint/suspicious/noConsole: reporting benchmark results
console.info(
  `Written ${runtimeEntries.length} runtime entries to ${runtimeOutputPath}`
)
// biome-ignore lint/suspicious/noConsole: reporting benchmark results
console.info(
  `Written ${memoryEntries.length} latency entries to ${memoryOutputPath}`
)

for (const entry of runtimeEntries) {
  // biome-ignore lint/suspicious/noConsole: reporting benchmark results
  console.info(`  ${entry.name}: ${entry.value} ${entry.unit} (${entry.range})`)
}
