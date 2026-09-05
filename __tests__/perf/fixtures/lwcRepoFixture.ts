'use strict'
import { initRepo } from '../../__utils__/gitFixtureRepo.js'
import { runGit, runGitText } from '../../__utils__/gitTestHarness.js'

export type LwcDiffRepoRefs = Readonly<{ root: string; head: string }>

const LWC_ROOT = 'force-app/main/default/lwc'
const NULL_OID = '0'.repeat(40)
const SCRIPT_CONTENT = 'export default class {}\n'
const MARKUP_CONTENT = '<template></template>\n'
const META_CONTENT =
  '<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"/>\n'

const hashBlob = (dir: string, content: string): string =>
  runGitText(['hash-object', '-w', '--stdin'], {
    cwd: dir,
    input: Buffer.from(content),
  })

const bundleName = (index: number, pad: number): string =>
  `cmp${String(index).padStart(pad, '0')}`

const scriptPath = (name: string): string => `${LWC_ROOT}/${name}/${name}.js`
const markupPath = (name: string): string => `${LWC_ROOT}/${name}/${name}.html`
const metaPath = (name: string): string =>
  `${LWC_ROOT}/${name}/${name}.js-meta.xml`

/**
 * N live bundles at `root` (script, markup, meta), the markup of every one
 * deleted at `head` — every diff line is index-needing and every bundle
 * survives. The sample this feeds is dominated by the git tree-diff walk
 * over all 3N files, buildTreeIndex's per-revision trie build, and
 * manifest aggregation; the liveness check itself is a handful of Trie
 * lookups, measured at ~0.3% of a sample. Nothing here is memoised across
 * samples: sgd()'s `finally` calls GitAdapter.closeAll() (src/main.ts),
 * clearing the pool, so every sample re-flattens both revisions'
 * blob-id indexes (indexRevision) from scratch on top of rebuilding the
 * trie. Built with one `update-index --index-info` per commit:
 * per-file plumbing (gitFixtureRepo's makeCommit) spawns two processes per
 * file, which at a few thousand files costs more than the bench itself.
 * Packed with `repack -adq` once history is built: real clones and CI
 * checkouts are packed, and an unpacked fixture would otherwise bench
 * tsgit's loose-object reader rather than sgd.
 */
export const buildLwcDiffRepo = (
  dir: string,
  bundleCount: number
): LwcDiffRepoRefs => {
  initRepo(dir)

  const scriptOid = hashBlob(dir, SCRIPT_CONTENT)
  const markupOid = hashBlob(dir, MARKUP_CONTENT)
  const metaOid = hashBlob(dir, META_CONTENT)
  const pad = String(bundleCount - 1).length

  const rootLines: string[] = []
  const markupPaths: string[] = []
  for (let index = 0; index < bundleCount; index++) {
    const name = bundleName(index, pad)
    rootLines.push(`100644 ${scriptOid}\t${scriptPath(name)}`)
    rootLines.push(`100644 ${markupOid}\t${markupPath(name)}`)
    rootLines.push(`100644 ${metaOid}\t${metaPath(name)}`)
    markupPaths.push(markupPath(name))
  }
  runGit(['update-index', '--add', '--index-info'], {
    cwd: dir,
    input: Buffer.from(`${rootLines.join('\n')}\n`),
  })
  const rootTreeOid = runGitText(['write-tree'], { cwd: dir })
  const root = runGitText(['commit-tree', rootTreeOid, '-m', 'root'], {
    cwd: dir,
  })

  const headLines = markupPaths.map(path => `0 ${NULL_OID}\t${path}`)
  runGit(['update-index', '--index-info'], {
    cwd: dir,
    input: Buffer.from(`${headLines.join('\n')}\n`),
  })
  const headTreeOid = runGitText(['write-tree'], { cwd: dir })
  const head = runGitText(
    ['commit-tree', headTreeOid, '-p', root, '-m', 'head'],
    { cwd: dir }
  )

  runGit(['update-ref', 'HEAD', head], { cwd: dir })
  // Real clones and CI checkouts are packed; a loose-object fixture would
  // bench tsgit's loose-object reader instead of sgd (108ms vs 16ms to
  // flatten at 3k files, 400ms vs 17ms at 9k).
  runGit(['repack', '-adq'], { cwd: dir })

  return { root, head }
}
