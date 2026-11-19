import { describe } from 'vitest'
import {
  RecordedChildren,
  RecordingChildParser,
  ReusingChildParser,
} from '../../lib/utils/metadataDiff/childReuse.js'
import {
  parseFromSideSwallowing,
  parseToSidePropagating,
} from '../../lib/utils/metadataDiff/xmlEventReader.js'
import { parseXml } from '../../lib/utils/txmlAdapter.js'
import {
  assertScalesLinearly,
  perfBench,
  type SampledRow,
} from './harness/perfBench.ts'

// Salesforce-shaped XML payloads at three rough sizes. The fixtures are
// generated in-memory rather than read from disk so the benchmark
// measures parse time only, not fs IO. The reuse rows record then reuse a
// reversed Profile (every child a miss) and must stay linear in its size.
const buildLabels = (count: number): string => {
  const labels = Array.from(
    { length: count },
    (_, i) =>
      `    <labels>\n      <fullName>Label_${i}</fullName>\n      <language>en_US</language>\n      <protected>false</protected>\n      <shortDescription>Short_${i}</shortDescription>\n      <value>Some value ${i} with spaces</value>\n    </labels>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">\n${labels}\n</CustomLabels>\n`
}

const buildProfile = (count: number): string => {
  const fps = Array.from(
    { length: count },
    (_, i) =>
      `    <fieldPermissions>\n      <editable>true</editable>\n      <field>Account.Field_${i}__c</field>\n      <readable>true</readable>\n    </fieldPermissions>`
  ).join('\n')
  const ops = Array.from(
    { length: Math.floor(count / 2) },
    (_, i) =>
      `    <objectPermissions>\n      <allowCreate>true</allowCreate>\n      <allowDelete>false</allowDelete>\n      <allowEdit>true</allowEdit>\n      <allowRead>true</allowRead>\n      <modifyAllRecords>false</modifyAllRecords>\n      <object>Object_${i}__c</object>\n      <viewAllRecords>false</viewAllRecords>\n    </objectPermissions>`
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n${fps}\n${ops}\n  <userLicense>Salesforce</userLicense>\n</Profile>\n`
}

const FIXTURES = {
  small: buildLabels(20),
  medium: buildProfile(200),
  large: buildProfile(2000),
} as const

const noopElement = (): void => undefined

for (const [size, payload] of Object.entries(FIXTURES) as Array<
  [keyof typeof FIXTURES, string]
>) {
  describe(`xml-parse-${size}`, () => {
    perfBench(`parseXml-${size}`, () => {
      parseXml(payload)
    })

    perfBench(`parseToSidePropagating-${size}`, async () => {
      await parseToSidePropagating(payload, noopElement)
    })

    perfBench(`parseFromSideSwallowing-${size}`, async () => {
      await parseFromSideSwallowing(payload, noopElement)
    })
  })
}

const REUSE_7K = 7_000
const REUSE_14K = 14_000

const fieldPermission = (i: number): string =>
  `    <fieldPermissions>\n      <editable>true</editable>\n      <field>Account.Field_${i}__c</field>\n      <readable>true</readable>\n    </fieldPermissions>`

const profileOf = (children: readonly string[]): string =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<Profile xmlns="http://soap.sforce.com/2006/04/metadata">\n${children.join('\n')}\n</Profile>\n`

const reversedProfilePair = (count: number) => {
  const children = Array.from({ length: count }, (_, i) => fieldPermission(i))
  return {
    from: profileOf(children),
    to: profileOf([...children].reverse()),
  }
}

const reuseRow = (
  name: string,
  pair: { from: string; to: string },
  check: (name: string, elapsedMs: readonly number[]) => void
): SampledRow => {
  const elapsedMs: number[] = []
  describe(name, () => {
    perfBench(
      name,
      async () => {
        const start = performance.now()
        const recorded = new RecordedChildren()
        await parseFromSideSwallowing(
          pair.from,
          noopElement,
          new RecordingChildParser(recorded)
        )
        await parseToSidePropagating(
          pair.to,
          noopElement,
          new ReusingChildParser(recorded)
        )
        elapsedMs.push(performance.now() - start)
      },
      { afterRun: () => check(name, elapsedMs) }
    )
  })
  return { label: name, samplesMs: elapsedMs }
}

const reversed7k = reuseRow(
  'metadata-diff-reuse-reversed-7k',
  reversedProfilePair(REUSE_7K),
  () => undefined
)
reuseRow(
  'metadata-diff-reuse-reversed-14k',
  reversedProfilePair(REUSE_14K),
  (name, elapsedMs) =>
    assertScalesLinearly(
      reversed7k,
      { label: name, samplesMs: elapsedMs },
      REUSE_14K / REUSE_7K
    )
)
