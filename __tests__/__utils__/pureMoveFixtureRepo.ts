'use strict'
import { type FixtureOp, makeCommit } from './gitFixtureRepo.ts'
import { runGit } from './gitTestHarness.ts'

export type FixtureFile = Readonly<{ path: string; content: string }>

export type ScenarioRefs = Readonly<{ from: string; to: string }>

export const PROJECT_FILE = 'sfdx-project.json'
export const DEFAULT_ROOT = 'force-app/main/default'
export const MOVED_ROOT = 'force-app/other'

export const CLASS_BODY = 'public class Foo {}\n'
export const CLASS_BODY_CHANGED = 'public class Foo { Integer x; }\n'
export const CLASS_META =
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>60.0</apiVersion></ApexClass>\n'
export const CLASS_META_CHANGED =
  '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>61.0</apiVersion></ApexClass>\n'
export const FIELD_META =
  '<CustomField xmlns="http://soap.sforce.com/2006/04/metadata"><fullName>S__c</fullName><type>Text</type></CustomField>\n'
export const LWC_JS = 'export default class Cmp {}\n'
export const LWC_JS_CHANGED = 'export default class Cmp { x = 1 }\n'
export const LWC_HTML = '<template></template>\n'
export const LWC_META =
  '<LightningComponentBundle xmlns="http://soap.sforce.com/2006/04/metadata"><isExposed>false</isExposed></LightningComponentBundle>\n'
export const LWC_CSS = ':host { display: block }\n'
export const REPORT_FOLDER_META =
  '<ReportFolder xmlns="http://soap.sforce.com/2006/04/metadata"/>\n'
export const REPORT_META =
  '<Report xmlns="http://soap.sforce.com/2006/04/metadata"/>\n'

export const file = (path: string, content: string): FixtureFile => ({
  path,
  content,
})

export const add = (path: string, content: string): FixtureOp => ({
  kind: 'add',
  mode: '100644',
  path,
  content,
})

export const remove = (path: string): FixtureOp => ({ kind: 'delete', path })

export const move = (from: string, to: string): FixtureOp => ({
  kind: 'rename',
  from,
  to,
})

export const classFiles = (
  root: string,
  name: string
): readonly FixtureFile[] => [
  file(`${root}/classes/${name}.cls`, CLASS_BODY),
  file(`${root}/classes/${name}.cls-meta.xml`, CLASS_META),
]

export const lwcFiles = (
  root: string,
  name: string
): readonly FixtureFile[] => [
  file(`${root}/lwc/${name}/${name}.js`, LWC_JS),
  file(`${root}/lwc/${name}/${name}.html`, LWC_HTML),
  file(`${root}/lwc/${name}/${name}.js-meta.xml`, LWC_META),
]

export const movesOf = (
  files: readonly FixtureFile[],
  fromRoot: string,
  toRoot: string
): readonly FixtureOp[] =>
  files.map(({ path }) => move(path, path.replace(fromRoot, toRoot)))

export const projectJson = (
  entries: readonly string[],
  sourceApiVersion?: string
): string =>
  `${JSON.stringify({
    packageDirectories: entries.map(path => ({ path })),
    ...(sourceApiVersion ? { sourceApiVersion } : {}),
  })}\n`

const labelXml = ([name, value]: readonly [string, string]): string =>
  `    <labels>\n        <fullName>${name}</fullName>\n        <language>en_US</language>\n        <protected>false</protected>\n        <shortDescription>${name}</shortDescription>\n        <value>${value}</value>\n    </labels>\n`

export const labelsXml = (labels: ReadonlyArray<[string, string]>): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">\n${labels.map(labelXml).join('')}</CustomLabels>\n`

export type LabelEntry = [string, string]

export const labelsPath = (directory: string, name = 'CustomLabels'): string =>
  `force-app/${directory}/labels/${name}.labels-meta.xml`

export const labels = (
  directory: string,
  entries: ReadonlyArray<LabelEntry>,
  name = 'CustomLabels'
): FixtureFile => file(labelsPath(directory, name), labelsXml(entries))

export const labelsAdd = (
  directory: string,
  entries: ReadonlyArray<LabelEntry>,
  name = 'CustomLabels'
): FixtureOp => add(labelsPath(directory, name), labelsXml(entries))

export const moveLabels = (
  from: string,
  to: string,
  name = 'CustomLabels'
): FixtureOp => move(labelsPath(from, name), labelsPath(to, name))

export const asPairs = (entries: ReadonlyArray<LabelEntry>): string[] =>
  entries.map(([name, value]) => `${name}=${value}`)

export const labelMembers = (names: readonly string[]): string[] =>
  names.map(name => `CustomLabel:${name}`)

export const L1: LabelEntry = ['L1', 'one']
export const L2: LabelEntry = ['L2', 'two']
export const A1: LabelEntry = ['A1', 'a1']
export const B1: LabelEntry = ['B1', 'b1']
export const B2: LabelEntry = ['B2', 'b2']
export const OTHER = 'Other'

const alertXml = (name: string, descriptionSuffix: string): string =>
  `    <alerts>\n        <fullName>${name}</fullName>\n        <description>${name}${descriptionSuffix}</description>\n    </alerts>\n`

export const workflowXml = (
  alerts: readonly string[],
  descriptionSuffix = ''
): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Workflow xmlns="http://soap.sforce.com/2006/04/metadata">\n${alerts.map(name => alertXml(name, descriptionSuffix)).join('')}</Workflow>\n`

// Every scenario is its own parentless pair of commits over an emptied
// index, so each one can carry its own sfdx-project.json.
export const buildScenario = (
  dir: string,
  name: string,
  base: readonly FixtureFile[],
  change: readonly FixtureOp[]
): ScenarioRefs => {
  runGit(['read-tree', '--empty'], { cwd: dir })
  const from = makeCommit(
    dir,
    null,
    `${name} base`,
    base.map(({ path, content }) => add(path, content))
  )
  const to = makeCommit(dir, from, `${name} change`, [...change])
  return { from, to }
}
