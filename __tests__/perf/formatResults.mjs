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

// A bench whose body throws still lands in the report, but with no samples —
// formatting it would fail on `undefined.toFixed` and hide which bench broke.
const unsampled = benchmarks.filter(
  b => b.hz === undefined || b.mean === undefined || b.rme === undefined
)
if (unsampled.length > 0) {
  throw new Error(
    `Benchmarks produced no samples (their body threw): ${unsampled
      .map(b => b.name)
      .join(', ')}`
  )
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
