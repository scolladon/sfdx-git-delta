'use strict'
import { initRepo } from '../../__utils__/gitFixtureRepo.ts'
import { runGit, runGitText } from '../../__utils__/gitTestHarness.ts'

export type ObjectTranslationRepoRefs = Readonly<{
  base: string
  head: string
  changedPaths: readonly string[]
}>

const TRANSLATIONS_ROOT = 'force-app/main/default/objectTranslations'
const NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'

const parentContent = (childCount: number, label: string): string => {
  const fields = Array.from(
    { length: childCount },
    (_, child) =>
      `    <fields>\n        <label>${label}${child}</label>\n        <name>F${child}__c</name>\n    </fields>\n`
  ).join('')
  return `<CustomObjectTranslation xmlns="${NAMESPACE}">\n${fields}</CustomObjectTranslation>\n`
}

const childContent = (name: string, label: string): string =>
  `<CustomFieldTranslation xmlns="${NAMESPACE}">\n    <label>${label}</label>\n    <name>${name}</name>\n</CustomFieldTranslation>\n`

const hashBlob = (dir: string, content: string): string =>
  runGitText(['hash-object', '-w', '--stdin'], {
    cwd: dir,
    input: Buffer.from(content),
  })

const commitIndex = (
  dir: string,
  lines: readonly string[],
  parent?: string
): string => {
  runGit(['update-index', '--add', '--index-info'], {
    cwd: dir,
    input: Buffer.from(`${lines.join('\n')}\n`),
  })
  const treeOid = runGitText(['write-tree'], { cwd: dir })
  const parentArgs = parent ? ['-p', parent] : []
  return runGitText(['commit-tree', treeOid, ...parentArgs, '-m', 'commit'], {
    cwd: dir,
  })
}

/**
 * `parentCount` sub-folder objectTranslations, each listing `childCount`
 * field entries (parent size grows with it) with every child
 * fieldTranslation modified at head. Per-child parent diffs cost
 * children x parent size; one diff per parent costs parent size alone.
 */
export const buildObjectTranslationRepo = (
  dir: string,
  parentCount: number,
  childCount: number
): ObjectTranslationRepoRefs => {
  initRepo(dir)
  const baseLines: string[] = []
  const headLines: string[] = []
  const changedPaths: string[] = []
  const stage = (lines: string[], path: string, content: string): void => {
    lines.push(`100644 ${hashBlob(dir, content)}\t${path}`)
  }
  for (let parent = 0; parent < parentCount; parent++) {
    const folder = `${TRANSLATIONS_ROOT}/O${parent}-fr`
    const parentPath = `${folder}/O${parent}-fr.objectTranslation-meta.xml`
    stage(baseLines, parentPath, parentContent(childCount, 'base'))
    stage(headLines, parentPath, parentContent(childCount, 'head'))
    for (let child = 0; child < childCount; child++) {
      const path = `${folder}/F${child}__c.fieldTranslation-meta.xml`
      stage(baseLines, path, childContent(`F${child}__c`, 'base'))
      stage(headLines, path, childContent(`F${child}__c`, 'head'))
      changedPaths.push(path)
    }
  }
  const base = commitIndex(dir, baseLines)
  const head = commitIndex(dir, headLines, base)
  runGit(['update-ref', 'HEAD', head], { cwd: dir })
  runGit(['repack', '-adq'], { cwd: dir })

  return { base, head, changedPaths }
}
