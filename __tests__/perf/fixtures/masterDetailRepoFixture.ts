'use strict'
import { initRepo } from '../../__utils__/gitFixtureRepo.ts'
import { runGit, runGitText } from '../../__utils__/gitTestHarness.ts'

export type MasterDetailRepoRefs = Readonly<{
  head: string
  fieldFiles: readonly string[]
  fieldDirs: readonly string[]
}>

const OBJECTS_ROOT = 'force-app/main/default/objects'
const FIELDS_PER_OBJECT = 4
const NAMESPACE = 'http://soap.sforce.com/2006/04/metadata'
const OBJECT_CONTENT = `<CustomObject xmlns="${NAMESPACE}"/>\n`

const fieldContent = (type: string): string =>
  `<CustomField xmlns="${NAMESPACE}">\n    <type>${type}</type>\n</CustomField>\n`

const hashBlob = (dir: string, content: string): string =>
  runGitText(['hash-object', '-w', '--stdin'], {
    cwd: dir,
    input: Buffer.from(content),
  })

/**
 * One commit holding `objectCount` objects, each with an object-meta file and
 * a fixed number of fields, the first of which is a MasterDetail. Built with
 * one `update-index --index-info` and packed, like the other repo fixtures:
 * per-file plumbing would cost more than the bench and a loose-object
 * fixture would bench the object reader instead of the grep.
 */
export const buildMasterDetailRepo = (
  dir: string,
  objectCount: number
): MasterDetailRepoRefs => {
  initRepo(dir)
  const objectOid = hashBlob(dir, OBJECT_CONTENT)
  const masterDetailOid = hashBlob(dir, fieldContent('MasterDetail'))
  const textOid = hashBlob(dir, fieldContent('Text'))

  const indexLines: string[] = []
  const fieldFiles: string[] = []
  const fieldDirs: string[] = []
  for (let index = 0; index < objectCount; index++) {
    const objectDir = `${OBJECTS_ROOT}/O${index}`
    indexLines.push(
      `100644 ${objectOid}\t${objectDir}/O${index}.object-meta.xml`
    )
    fieldDirs.push(`${objectDir}/fields`)
    for (let field = 0; field < FIELDS_PER_OBJECT; field++) {
      const path = `${objectDir}/fields/F${field}__c.field-meta.xml`
      indexLines.push(
        `100644 ${field === 0 ? masterDetailOid : textOid}\t${path}`
      )
      fieldFiles.push(path)
    }
  }
  runGit(['update-index', '--add', '--index-info'], {
    cwd: dir,
    input: Buffer.from(`${indexLines.join('\n')}\n`),
  })
  const treeOid = runGitText(['write-tree'], { cwd: dir })
  const head = runGitText(['commit-tree', treeOid, '-m', 'head'], { cwd: dir })
  runGit(['update-ref', 'HEAD', head], { cwd: dir })
  runGit(['repack', '-adq'], { cwd: dir })

  return { head, fieldFiles, fieldDirs }
}
