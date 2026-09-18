'use strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

import type sgd from '../../src/main'
import type { ConfigInput } from '../../src/types/config'
import { ChangeKind } from '../../src/types/handlerResult'

// Mirrors the private shape ChangesManifestProcessor writes to disk, so
// rename-bucket assertions can read the file back typed rather than as
// `unknown`.
type RenamePairJson = { from: string; to: string }
export type ChangesManifestJson = {
  [ChangeKind.Add]: Record<string, string[]>
  [ChangeKind.Modify]: Record<string, string[]>
  [ChangeKind.Delete]: Record<string, string[]>
  [ChangeKind.Rename]: Record<string, RenamePairJson[]>
}

type RunSgdResult = {
  work: Awaited<ReturnType<typeof sgd>>
  packageXml: string
  destructiveXml: string
}

// Both halves must share identical overrides: IgnoreHelper caches its
// singleton on first call regardless of arguments, so the `off` and `on`
// runs below share one cached helper.
export const runBothModes = async (
  runSgd: (overrides: Partial<ConfigInput>) => Promise<RunSgdResult>,
  trackedTempDir: (prefix: string) => Promise<string>,
  manifestDirPrefix: string,
  overrides: Partial<ConfigInput> = {}
): Promise<{
  off: RunSgdResult
  on: RunSgdResult
  payload: ChangesManifestJson
}> => {
  const off = await runSgd(overrides)
  const changesManifest = join(
    await trackedTempDir(manifestDirPrefix),
    'changes.manifest.json'
  )
  const on = await runSgd({ ...overrides, changesManifest })
  const payload = JSON.parse(
    await readFile(changesManifest, 'utf8')
  ) as ChangesManifestJson
  return { off, on, payload }
}
