import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// No GitHub token, repository or PR number is read here: this script runs
// inside the job that executes the pull request's own code, so it must not
// hold anything that can write to GitHub. Posting is a separate job's job —
// see `perf-comment`, which reads the file this writes from the uploaded
// `perf-report` artifact.

const RUNTIME_THRESHOLD = 1.3
const MEMORY_THRESHOLD = 1.5

const loadJson = path =>
  existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) : []

// An absent PR file means the bench run did not complete. Loading it as []
// would compare nothing against nothing and report "No regressions detected",
// turning a failed run into a clean bill of health.
for (const required of ['perf-runtime.json', 'perf-memory.json']) {
  if (!existsSync(required)) {
    throw new Error(
      `${required} is missing: the benchmark run did not complete, so there is nothing to compare. Refusing to report on absent data.`
    )
  }
}

const baseRuntime = loadJson('perf-runtime-base.json')
const prRuntime = loadJson('perf-runtime.json')
const baseMemory = loadJson('perf-memory-base.json')
const prMemory = loadJson('perf-memory.json')

const toMap = entries =>
  new Map(entries.map(entry => [entry.name, entry.value]))

const baseRuntimeMap = toMap(baseRuntime)
const baseMemoryMap = toMap(baseMemory)

const namesOf = entries => new Set(entries.map(entry => entry.name))
// A base row with no PR counterpart is a benchmark that was renamed, deleted,
// skipped, or produced no row. Skipping it would report the remaining rows as
// a complete comparison, turning a vanished benchmark into a clean bill of
// health — the same silence the missing-file guard above refuses.
const missingFromRun = (base, prNames) =>
  base.filter(entry => !prNames.has(entry.name))
const newInRun = (pr, baseNames) =>
  pr.filter(entry => !baseNames.has(entry.name))

const prRuntimeNames = namesOf(prRuntime)
const baseRuntimeNames = namesOf(baseRuntime)
const prMemoryNames = namesOf(prMemory)
const baseMemoryNames = namesOf(baseMemory)

const missingRuntime = missingFromRun(baseRuntime, prRuntimeNames)
const newRuntime = newInRun(prRuntime, baseRuntimeNames)
const missingMemory = missingFromRun(baseMemory, prMemoryNames)
const newMemory = newInRun(prMemory, baseMemoryNames)

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

const tableRow = r =>
  `| ${r.name} | ${r.base} | ${r.pr} | ${r.ratio} | ${r.change} |`
const tableHeader = '| Benchmark | Base | PR | Ratio | Change |\n|-|-|-|-|-|'

const formatValue = entry =>
  entry.unit === 'ms' ? `${entry.value}ms` : entry.value
const reconciliationRow = (entry, series) =>
  `| ${entry.name} | ${series} | ${formatValue(entry)} |`
const reconciliationHeader = column =>
  `| Benchmark | Series | ${column} |\n|-|-|-|`
const RENAME_LEGEND =
  'A renamed benchmark appears here under its old name and under "new" ' +
  'below with its new name; a deleted or skipped benchmark, or one that ' +
  'produced no row, appears only here. The tables below are not a ' +
  'complete comparison.'

const missingRows = [
  ...missingRuntime.map(entry => reconciliationRow(entry, 'runtime')),
  ...missingMemory.map(entry => reconciliationRow(entry, 'memory')),
]
const newRows = [
  ...newRuntime.map(entry => reconciliationRow(entry, 'runtime')),
  ...newMemory.map(entry => reconciliationRow(entry, 'memory')),
]

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

if (missingRows.length > 0) {
  lines.push('## Benchmarks missing from this run\n')
  lines.push(reconciliationHeader('Base'))
  missingRows.forEach(r => lines.push(r))
  lines.push('')
}

// A "new" row with no "missing" section above it has nothing to be a rename
// counterpart to — the legend only makes sense once a benchmark actually
// vanished from the base series.
if (missingRows.length > 0) {
  lines.push(RENAME_LEGEND)
  lines.push('')
}

if (newRows.length > 0) {
  lines.push('## Benchmarks new in this run\n')
  lines.push(reconciliationHeader('PR'))
  newRows.forEach(r => lines.push(r))
  lines.push('')
}

lines.push('## Stable\n')
lines.push(tableHeader)
stable.forEach(r => lines.push(tableRow(r)))
lines.push('')

const report = lines.join('\n')
writeFileSync('perf-comparison.md', report)

console.log(report)

// Perf regressions are informational only — the PR comment + Actions
// annotation carry the signal, but the job never blocks the merge (see
// reusable-perf.yml `continue-on-error` + job comment). Emit a ::warning::
// so regressions surface in the Actions summary, then exit 0.
if (regressions.length > 0) {
  console.log(
    `\n::warning::${regressions.length} performance regression(s) detected (runtime threshold: ${RUNTIME_THRESHOLD}x, latency threshold: ${MEMORY_THRESHOLD}x) — see PR comment for details`
  )
} else {
  console.log('No regressions detected.')
}

// A missing benchmark can mean a rename, a deletion, a skip, or a crash —
// the direction most likely to hide a real failure, so it is named in full,
// not just counted. A benchmark missing from both series is one name, not
// two rows, so the count and the name list dedupe across series; the table
// above keeps the per-series detail. A new benchmark is comparatively
// low-risk (nothing regressed against it yet), so it gets a ::notice::
// rather than a ::warning::.
const uniqueNames = entries => [...new Set(entries.map(entry => entry.name))]

const missingNames = uniqueNames([...missingRuntime, ...missingMemory])
if (missingNames.length > 0) {
  console.log(
    `\n::warning::${missingNames.length} benchmark(s) missing from this run: ${missingNames.join(', ')}`
  )
}

const newNames = uniqueNames([...newRuntime, ...newMemory])
if (newNames.length > 0) {
  console.log(
    `\n::notice::${newNames.length} new benchmark(s) in this run: ${newNames.join(', ')}`
  )
}
