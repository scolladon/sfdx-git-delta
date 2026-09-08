import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Resolved relative to this file's own URL, never process.cwd(): the spawned
// script must be locatable regardless of which directory the test runner
// itself was launched from.
export const COMPARE_BASELINE_ENTRY = fileURLToPath(
  new URL('../perf/compareBaseline.mjs', import.meta.url)
)

export const writeJson = (path: string, entries: unknown) =>
  writeFile(path, JSON.stringify(entries))
