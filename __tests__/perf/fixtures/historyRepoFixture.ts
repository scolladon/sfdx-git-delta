'use strict'
import { initRepo } from '../../__utils__/gitFixtureRepo.js'
import { runGit } from '../../__utils__/gitTestHarness.js'

export type HistoryRepoRefs = Readonly<{
  from: string
  to: string
  blobPaths: readonly string[]
}>

// resolveCommit walks this many parents, exactly as it does against the
// worktree's own history today — kept symbolic so the bench still exercises
// a real parent walk, not a literal OID.
export const HISTORY_DEPTH = 20

const BRANCH_REF = 'refs/heads/main'
const IDENTITY = 'sgd-test <sgd-test@example.com>'
// A stray digit of wall-clock time would still make every OID a pure
// function of this file's own logic, but a literal constant makes that
// obvious on read rather than requiring the reader to trust it.
const BASE_EPOCH_SECONDS = 1_700_000_000
const MODE = '100644'

const TYPE_NAMES = [
  'classes',
  'objects',
  'layouts',
  'flows',
  'permissionsets',
  'staticresources',
  'lwc',
  'aura',
  'triggers',
  'pages',
] as const
const DIR_COUNT = 20
// Root + churn lands the shape at sgd's own scale: 364 root files, 400
// tracked at HEAD (364 - 7 deleted + 43 added), 193 changed paths across
// the 20-commit range (143 M = 141 regular + the 2 blobs below, 43 A, 7 D) —
// the same order of magnitude as HEAD~20..HEAD on the sgd checkout itself
// (358 tracked files; 193 paths, 43 A / 7 D / 143 M).
const REGULAR_FILE_COUNT = 362
const MODIFY_COUNT = 141
const DELETE_COUNT = 7
const NEW_FILE_COUNT = 43
const BLOB_SIZE_BYTES = 9 * 1024

const BLOB_PATH_A = 'force-app/main/default/classes/LargeBlobA.cls'
const BLOB_PATH_B = 'force-app/main/default/classes/LargeBlobB.cls'

const regularPath = (dirIndex: number, fileIndex: number): string =>
  `force-app/main/default/${TYPE_NAMES[dirIndex % TYPE_NAMES.length]}/dir${dirIndex}/file${fileIndex}.txt`

const buildRegularPaths = (count: number): string[] => {
  const paths: string[] = []
  let dirIndex = 0
  let fileIndex = 0
  while (paths.length < count) {
    paths.push(regularPath(dirIndex, fileIndex))
    dirIndex += 1
    if (dirIndex === DIR_COUNT) {
      dirIndex = 0
      fileIndex += 1
    }
  }
  return paths
}

// Spreads `total` as evenly as possible over `buckets`, front-loading the
// remainder so every bucket's count is deterministic from its index alone.
const distribute = (total: number, buckets: number): number[] => {
  const base = Math.floor(total / buckets)
  const remainder = total % buckets
  return Array.from({ length: buckets }, (_, index) =>
    index < remainder ? base + 1 : base
  )
}

const fileContent = (path: string, revision: number): string =>
  `${path} rev${revision}\n`

// Fixed length regardless of `revision`'s digit count, so every blob write
// is the same ~9 KB getBufferContent is meant to cost.
const blobContent = (label: string, revision: number): string => {
  const line = `${label}-rev${revision}-`
  const repeated = line.repeat(Math.ceil(BLOB_SIZE_BYTES / line.length))
  return `${repeated.slice(0, BLOB_SIZE_BYTES - 1)}\n`
}

const dataBlock = (content: string): string =>
  `data ${Buffer.byteLength(content, 'utf8')}\n${content}`

const modifyLine = (path: string, content: string): string =>
  `M ${MODE} inline ${path}\n${dataBlock(content)}`

const deleteLine = (path: string): string => `D ${path}\n`

const commitBlock = (revision: number, message: string): string =>
  `commit ${BRANCH_REF}\n` +
  `author ${IDENTITY} ${BASE_EPOCH_SECONDS + revision} +0000\n` +
  `committer ${IDENTITY} ${BASE_EPOCH_SECONDS + revision} +0000\n` +
  dataBlock(`${message}\n`)

/**
 * Builds a self-contained, deterministic history in `dir` (already an empty
 * directory): a root commit plus HISTORY_DEPTH commits, sized to sgd's own
 * HEAD~20..HEAD shape so the four gitAdapter benches keep their scale. Built
 * with one `git fast-import` stream carrying fixed author/committer
 * timestamps — same input, same OIDs, on every machine and every run
 * (measured: 58-100 ms across three runs on a dev machine, load-dependent,
 * not a promised bound; 4 spawns total for the whole build — init,
 * fast-import, symbolic-ref, repack — identical `HEAD`/`HEAD~20` OIDs across
 * repeated builds). fast-import writes
 * `refs/heads/main` directly; `HEAD` still follows the runner's
 * `init.defaultBranch` until pointed there explicitly. Finished with
 * `repack -adq` so the bench reads one pack, the way a real clone or CI
 * checkout does — an unpacked fixture would bench tsgit's loose-object
 * reader instead of sgd. Plumbing only: no working-tree checkout, no
 * symlinks, no executable bits, so it builds on the Windows legs too.
 */
export const buildHistoryRepo = (dir: string): HistoryRepoRefs => {
  initRepo(dir)

  const regularPaths = buildRegularPaths(REGULAR_FILE_COUNT)
  const modifyPaths = regularPaths.slice(0, MODIFY_COUNT)
  const deletePaths = regularPaths.slice(
    MODIFY_COUNT,
    MODIFY_COUNT + DELETE_COUNT
  )

  const chunks: string[] = []

  chunks.push(commitBlock(0, 'root'))
  for (const path of regularPaths) {
    chunks.push(modifyLine(path, fileContent(path, 0)))
  }
  chunks.push(modifyLine(BLOB_PATH_A, blobContent('blob-a', 0)))
  chunks.push(modifyLine(BLOB_PATH_B, blobContent('blob-b', 0)))

  const modifyCounts = distribute(MODIFY_COUNT, HISTORY_DEPTH)
  const deleteCounts = distribute(DELETE_COUNT, HISTORY_DEPTH)
  const newCounts = distribute(NEW_FILE_COUNT, HISTORY_DEPTH)
  let modifyCursor = 0
  let deleteCursor = 0
  let newCursor = 0

  for (let commitIndex = 0; commitIndex < HISTORY_DEPTH; commitIndex++) {
    const revision = commitIndex + 1
    chunks.push(commitBlock(revision, `history ${revision}`))
    chunks.push(modifyLine(BLOB_PATH_A, blobContent('blob-a', revision)))
    chunks.push(modifyLine(BLOB_PATH_B, blobContent('blob-b', revision)))

    for (let i = 0; i < modifyCounts[commitIndex]; i++) {
      const path = modifyPaths[modifyCursor]
      modifyCursor += 1
      chunks.push(modifyLine(path, fileContent(path, revision)))
    }
    for (let i = 0; i < deleteCounts[commitIndex]; i++) {
      const path = deletePaths[deleteCursor]
      deleteCursor += 1
      chunks.push(deleteLine(path))
    }
    for (let i = 0; i < newCounts[commitIndex]; i++) {
      const path = `force-app/main/default/added/newFile${newCursor}.txt`
      newCursor += 1
      chunks.push(modifyLine(path, fileContent(path, revision)))
    }
  }

  runGit(['fast-import', '--quiet', '--date-format=raw'], {
    cwd: dir,
    input: Buffer.from(chunks.join(''), 'utf8'),
  })
  runGit(['symbolic-ref', 'HEAD', BRANCH_REF], { cwd: dir })
  runGit(['repack', '-adq'], { cwd: dir })

  return {
    from: `HEAD~${HISTORY_DEPTH}`,
    to: 'HEAD',
    blobPaths: [BLOB_PATH_A, BLOB_PATH_B],
  }
}
