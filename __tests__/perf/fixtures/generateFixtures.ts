import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../src/constant/gitConstants.js'
import {
  ChangeKind,
  CopyOperationKind,
  type HandlerResult,
  ManifestTarget,
} from '../../../src/types/handlerResult.js'

const CHANGE_KIND_BY_GIT: Record<string, ChangeKind> = {
  [ADDITION]: ChangeKind.Add,
  [MODIFICATION]: ChangeKind.Modify,
  [DELETION]: ChangeKind.Delete,
}

type FixtureSize = 'small' | 'medium' | 'large'

interface SizeConfig {
  readonly classes: number
  readonly triggers: number
  readonly lwcComponents: number
  readonly customObjects: number
  readonly profiles: number
}

const SIZE_CONFIGS: Record<FixtureSize, SizeConfig> = {
  small: {
    classes: 5,
    triggers: 2,
    lwcComponents: 2,
    customObjects: 1,
    profiles: 0,
  },
  medium: {
    classes: 30,
    triggers: 10,
    lwcComponents: 15,
    customObjects: 5,
    profiles: 2,
  },
  large: {
    classes: 150,
    triggers: 40,
    lwcComponents: 50,
    customObjects: 20,
    profiles: 5,
  },
}

const pad = (n: number): string => String(n).padStart(4, '0')

const generateDiffLines = (config: SizeConfig): string[] => {
  const lines: string[] = []

  for (let i = 0; i < config.classes; i++) {
    const changeType =
      i % 3 === 0 ? ADDITION : i % 3 === 1 ? MODIFICATION : DELETION
    lines.push(
      `${changeType}\tforce-app/main/default/classes/MyClass${pad(i)}.cls`
    )
    lines.push(
      `${changeType}\tforce-app/main/default/classes/MyClass${pad(i)}.cls-meta.xml`
    )
  }

  for (let i = 0; i < config.triggers; i++) {
    lines.push(
      `${ADDITION}\tforce-app/main/default/triggers/MyTrigger${pad(i)}.trigger`
    )
    lines.push(
      `${ADDITION}\tforce-app/main/default/triggers/MyTrigger${pad(i)}.trigger-meta.xml`
    )
  }

  for (let i = 0; i < config.lwcComponents; i++) {
    lines.push(
      `${MODIFICATION}\tforce-app/main/default/lwc/myComponent${pad(i)}/myComponent${pad(i)}.js`
    )
    lines.push(
      `${MODIFICATION}\tforce-app/main/default/lwc/myComponent${pad(i)}/myComponent${pad(i)}.html`
    )
    lines.push(
      `${MODIFICATION}\tforce-app/main/default/lwc/myComponent${pad(i)}/myComponent${pad(i)}.js-meta.xml`
    )
  }

  for (let i = 0; i < config.customObjects; i++) {
    lines.push(
      `${MODIFICATION}\tforce-app/main/default/objects/CustomObj${pad(i)}__c/CustomObj${pad(i)}__c.object-meta.xml`
    )
    lines.push(
      `${ADDITION}\tforce-app/main/default/objects/CustomObj${pad(i)}__c/fields/NewField__c.field-meta.xml`
    )
  }

  for (let i = 0; i < config.profiles; i++) {
    lines.push(
      `${MODIFICATION}\tforce-app/main/default/profiles/Admin${pad(i)}.profile-meta.xml`
    )
  }

  return lines
}

export const generateDiffFixtures = (
  size: FixtureSize
): { readonly lines: string[] } => ({
  lines: generateDiffLines(SIZE_CONFIGS[size]),
})

export const generateHandlerResult = (size: FixtureSize): HandlerResult => {
  const config = SIZE_CONFIGS[size]
  const manifests = []
  const copies = []

  for (let i = 0; i < config.classes; i++) {
    const gitType =
      i % 3 === 0 ? ADDITION : i % 3 === 1 ? MODIFICATION : DELETION
    manifests.push({
      type: 'ApexClass',
      member: `MyClass${pad(i)}`,
      target:
        gitType === DELETION
          ? ManifestTarget.DestructiveChanges
          : ManifestTarget.Package,
      changeKind: CHANGE_KIND_BY_GIT[gitType]!,
    })
    copies.push({
      source: `force-app/main/default/classes/MyClass${pad(i)}.cls`,
      destination: `output/classes/MyClass${pad(i)}.cls`,
      kind: CopyOperationKind.SingleFile,
    })
  }

  for (let i = 0; i < config.triggers; i++) {
    manifests.push({
      type: 'ApexTrigger',
      member: `MyTrigger${pad(i)}`,
      target: ManifestTarget.Package,
      changeKind: ChangeKind.Add,
    })
  }

  for (let i = 0; i < config.lwcComponents; i++) {
    manifests.push({
      type: 'LightningComponentBundle',
      member: `myComponent${pad(i)}`,
      target: ManifestTarget.Package,
      changeKind: ChangeKind.Modify,
    })
  }

  for (let i = 0; i < config.customObjects; i++) {
    manifests.push({
      type: 'CustomObject',
      member: `CustomObj${pad(i)}__c`,
      target: ManifestTarget.Package,
      changeKind: ChangeKind.Modify,
    })
    manifests.push({
      type: 'CustomField',
      member: `CustomObj${pad(i)}__c.NewField__c`,
      target: ManifestTarget.Package,
      changeKind: ChangeKind.Add,
    })
  }

  const deletionCount = Math.floor(config.classes / 3)
  for (let i = 0; i < deletionCount; i++) {
    manifests.push({
      type: 'ApexClass',
      member: `DeletedClass${pad(i)}`,
      target: ManifestTarget.DestructiveChanges,
      changeKind: ChangeKind.Delete,
    })
  }

  return { manifests, copies, warnings: [] }
}
