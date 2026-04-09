import FlexParser from '@nodable/flexible-xml-parser'
import { XMLParser as FxpParser } from 'fast-xml-parser'
import { bench, describe } from 'vitest'

// Current fast-xml-parser config (from src/utils/xmlHelper.ts)
const FXP_OPTION = {
  commentPropName: '#comment',
  ignoreAttributes: false,
  ignoreNameSpace: false,
  parseTagValue: false,
  parseNodeValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: false,
}

// Equivalent flexible-xml-parser config (same output structure)
const FLEX_OPTION = {
  skip: {
    attributes: false,
    nsPrefix: false,
    comment: false,
    declaration: false,
  },
  nameFor: {
    comment: '#comment',
  },
  attributes: {
    prefix: '@_',
    valueParsers: [],
  },
  tags: {
    valueParsers: ['trim'],
  },
}

const generateProfileXml = (fieldCount: number): string => {
  const fields = Array.from(
    { length: fieldCount },
    (_, i) => `    <fieldPermissions>
        <editable>true</editable>
        <field>CustomObj__c.Field${String(i).padStart(4, '0')}__c</field>
        <readable>true</readable>
    </fieldPermissions>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Profile xmlns="http://soap.sforce.com/2006/04/metadata">
    <applicationVisibilities>
        <application>standard__LightningSales</application>
        <default>false</default>
        <visible>true</visible>
    </applicationVisibilities>
${fields}
    <userLicense>Salesforce</userLicense>
</Profile>`
}

const generateCustomLabelsXml = (labelCount: number): string => {
  const labels = Array.from(
    { length: labelCount },
    (_, i) => `    <labels>
        <fullName>Label_${String(i).padStart(4, '0')}</fullName>
        <language>en_US</language>
        <protected>false</protected>
        <shortDescription>Label ${i}</shortDescription>
        <value>This is the value for label number ${i} with some realistic text content</value>
    </labels>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
${labels}
</CustomLabels>`
}

const generatePermissionSetXml = (size: number): string => {
  const fields = Array.from(
    { length: size },
    (_, i) => `    <fieldPermissions>
        <editable>true</editable>
        <field>Account.CustomField${String(i).padStart(4, '0')}__c</field>
        <readable>true</readable>
    </fieldPermissions>`
  ).join('\n')

  const objects = Array.from(
    { length: Math.floor(size / 5) },
    (_, i) => `    <objectPermissions>
        <allowCreate>true</allowCreate>
        <allowDelete>false</allowDelete>
        <allowEdit>true</allowEdit>
        <allowRead>true</allowRead>
        <modifyAllRecords>false</modifyAllRecords>
        <object>CustomObj${String(i).padStart(4, '0')}__c</object>
        <viewAllRecords>true</viewAllRecords>
    </objectPermissions>`
  ).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<PermissionSet xmlns="http://soap.sforce.com/2006/04/metadata">
    <description>Test permission set</description>
    <hasActivationRequired>false</hasActivationRequired>
    <label>TestPermSet</label>
${fields}
${objects}
</PermissionSet>`
}

const sizes = [
  { name: 'small', fields: 10 },
  { name: 'medium', fields: 100 },
  { name: 'large', fields: 500 },
] as const

for (const { name, fields } of sizes) {
  const profileXml = generateProfileXml(fields)
  const labelsXml = generateCustomLabelsXml(fields)
  const permSetXml = generatePermissionSetXml(fields)

  describe(`xml-parse-profile-${name} (${profileXml.length} chars)`, () => {
    bench(`fxp-profile-${name}`, () => {
      const parser = new FxpParser(FXP_OPTION)
      parser.parse(profileXml)
    })

    bench(`flex-profile-${name}`, () => {
      const parser = new FlexParser(FLEX_OPTION)
      parser.parse(profileXml)
    })
  })

  describe(`xml-parse-labels-${name} (${labelsXml.length} chars)`, () => {
    bench(`fxp-labels-${name}`, () => {
      const parser = new FxpParser(FXP_OPTION)
      parser.parse(labelsXml)
    })

    bench(`flex-labels-${name}`, () => {
      const parser = new FlexParser(FLEX_OPTION)
      parser.parse(labelsXml)
    })
  })

  describe(`xml-parse-permset-${name} (${permSetXml.length} chars)`, () => {
    bench(`fxp-permset-${name}`, () => {
      const parser = new FxpParser(FXP_OPTION)
      parser.parse(permSetXml)
    })

    bench(`flex-permset-${name}`, () => {
      const parser = new FlexParser(FLEX_OPTION)
      parser.parse(permSetXml)
    })
  })
}

// Reuse parser instance benchmark (amortize construction cost)
const largeProfileXml = generateProfileXml(500)
const reuseFxpParser = new FxpParser(FXP_OPTION)
const reuseFlexParser = new FlexParser(FLEX_OPTION)

describe('xml-parse-reuse-instance (large profile)', () => {
  bench('fxp-reuse', () => {
    reuseFxpParser.parse(largeProfileXml)
  })

  bench('flex-reuse', () => {
    reuseFlexParser.parse(largeProfileXml)
  })
})
