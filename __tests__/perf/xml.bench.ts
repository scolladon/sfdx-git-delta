import { bench, describe } from 'vitest'

import { xml2Json } from '../../src/utils/xmlHelper.js'

// Salesforce-shaped XML payloads at three rough sizes. The fixtures are
// generated in-memory rather than read from disk so the benchmark
// measures parse time only, not fs IO.
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

for (const [size, payload] of Object.entries(FIXTURES) as Array<
  [keyof typeof FIXTURES, string]
>) {
  describe(`xml-parse-${size}`, () => {
    bench(`xml2Json-${size}`, () => {
      xml2Json(payload)
    })
  })
}
