'use strict'
import { initRepo } from '../../__utils__/gitFixtureRepo.ts'
import { runGit, runGitText } from '../../__utils__/gitTestHarness.ts'

export type LabelsUnionRepoRefs = Readonly<{
  from: string
  to: string
  movedFrom: string
  movedTo: string
}>

const FROM_ROOT = 'force-app/main/default/labels'
const TO_ROOT = 'force-app/other/labels'
const MOVED_INDEX = 0
const XML_HEADER =
  '<?xml version="1.0" encoding="UTF-8"?>\n<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">\n'
const XML_FOOTER = '</CustomLabels>\n'

const fileName = (file: number): string => `Labels${file}.labels-meta.xml`

const labelXml = (file: number, label: number): string =>
  `  <labels>\n    <fullName>L${file}_${label}</fullName>\n    <language>en_US</language>\n    <protected>false</protected>\n    <shortDescription>L${file}_${label}</shortDescription>\n    <value>value ${file} ${label}</value>\n  </labels>\n`

const containerXml = (file: number, labelCount: number): string =>
  XML_HEADER +
  Array.from({ length: labelCount }, (_, label) => labelXml(file, label)).join(
    ''
  ) +
  XML_FOOTER

const hashBlob = (dir: string, content: string): string =>
  runGitText(['hash-object', '-w', '--stdin'], {
    cwd: dir,
    input: Buffer.from(content),
  })

const commitIndex = (dir: string, lines: string[], parent?: string): string => {
  runGit(['update-index', '--add', '--index-info'], {
    cwd: dir,
    input: Buffer.from(`${lines.join('\n')}\n`),
  })
  const tree = runGitText(['write-tree'], { cwd: dir })
  const args = parent
    ? ['commit-tree', tree, '-p', parent, '-m', 'move']
    : ['commit-tree', tree, '-m', 'root']
  return runGitText(args, { cwd: dir })
}

/**
 * One package directory holding `fileCount` labels containers of
 * `labelsPerFile` labels each; at `to` the first container moved to another
 * root unchanged and the others stayed. Built with `update-index
 * --index-info` per commit (never per-file plumbing) and packed, as real
 * clones are.
 */
export const buildLabelsUnionRepo = (
  dir: string,
  fileCount: number,
  labelsPerFile: number
): LabelsUnionRepoRefs => {
  initRepo(dir)
  const oids = Array.from({ length: fileCount }, (_, file) =>
    hashBlob(dir, containerXml(file, labelsPerFile))
  )
  const entry = (oid: string, path: string): string => `100644 ${oid}\t${path}`
  const rootLines = oids.map((oid, file) =>
    entry(oid, `${FROM_ROOT}/${fileName(file)}`)
  )
  const from = commitIndex(dir, rootLines)

  const movedFrom = `${FROM_ROOT}/${fileName(MOVED_INDEX)}`
  const movedTo = `${TO_ROOT}/${fileName(MOVED_INDEX)}`
  const moveLines = [
    `0 ${'0'.repeat(40)}\t${movedFrom}`,
    entry(oids[MOVED_INDEX]!, movedTo),
  ]
  const to = commitIndex(dir, moveLines, from)

  runGit(['update-ref', 'HEAD', to], { cwd: dir })
  runGit(['repack', '-adq'], { cwd: dir })
  return { from, to, movedFrom, movedTo }
}
