import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const RUNTIME_THRESHOLD = 1.3
const MEMORY_THRESHOLD = 1.5

const loadJson = path =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : []

const baseRuntime = loadJson('perf-runtime-base.json')
const prRuntime = loadJson('perf-runtime.json')
const baseMemory = loadJson('perf-memory-base.json')
const prMemory = loadJson('perf-memory.json')

const toMap = entries =>
  new Map(entries.map(entry => [entry.name, entry.value]))

const baseRuntimeMap = toMap(baseRuntime)
const baseMemoryMap = toMap(baseMemory)

const regressions = []
const improvements = []
const stable = []

for (const entry of prRuntime) {
  const baseVal = baseRuntimeMap.get(entry.name)
  if (baseVal == null) continue
  const ratio = baseVal / entry.value
  const pct = ((ratio - 1) * 100).toFixed(1)
  const row = {
    name: entry.name,
    base: baseVal,
    pr: entry.value,
    unit: 'ops/sec',
    ratio: ratio.toFixed(2),
    change: ratio > 1 ? `-${pct}%` : `+${Math.abs(pct)}%`,
  }
  if (ratio >= RUNTIME_THRESHOLD) regressions.push(row)
  else if (ratio <= 1 / RUNTIME_THRESHOLD) improvements.push(row)
  else stable.push(row)
}

for (const entry of prMemory) {
  const baseVal = baseMemoryMap.get(entry.name)
  if (baseVal == null) continue
  const ratio = entry.value / baseVal
  const pct = ((ratio - 1) * 100).toFixed(1)
  const row = {
    name: `${entry.name} (mean)`,
    base: `${baseVal}ms`,
    pr: `${entry.value}ms`,
    unit: 'ms',
    ratio: ratio.toFixed(2),
    change: ratio > 1 ? `+${pct}%` : `-${Math.abs(pct)}%`,
  }
  if (ratio >= MEMORY_THRESHOLD) regressions.push(row)
  else if (ratio <= 1 / MEMORY_THRESHOLD) improvements.push(row)
  else stable.push(row)
}

const tableRow = r => `| ${r.name} | ${r.base} | ${r.pr} | ${r.ratio} | ${r.change} |`
const tableHeader = '| Benchmark | Base | PR | Ratio | Change |\n|-|-|-|-|-|'

const lines = ['# Performance Comparison (same runner)\n']

if (regressions.length > 0) {
  lines.push('## Regressions\n')
  lines.push(tableHeader)
  regressions.forEach(r => lines.push(tableRow(r)))
  lines.push('')
}

if (improvements.length > 0) {
  lines.push('## Improvements\n')
  lines.push(tableHeader)
  improvements.forEach(r => lines.push(tableRow(r)))
  lines.push('')
}

lines.push('## Stable\n')
lines.push(tableHeader)
stable.forEach(r => lines.push(tableRow(r)))
lines.push('')

const report = lines.join('\n')
writeFileSync('perf-comparison.md', report)

// biome-ignore lint/suspicious/noConsole: CI output
console.info(report)

if (regressions.length > 0) {
  // biome-ignore lint/suspicious/noConsole: CI output
  console.error(
    `\n::error::${regressions.length} performance regression(s) detected (runtime threshold: ${RUNTIME_THRESHOLD}x, memory threshold: ${MEMORY_THRESHOLD}x)`
  )
  process.exit(1)
}

// biome-ignore lint/suspicious/noConsole: CI output
console.info('No regressions detected.')
