import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../src/constant/gitConstants.js'
import {
  type AddKind,
  ChangeKind,
  type ManifestElement,
  ManifestTarget,
} from '../../../src/types/handlerResult.js'

const CHANGE_KIND_BY_GIT: Record<string, AddKind> = {
  [ADDITION]: ChangeKind.Add,
  [MODIFICATION]: ChangeKind.Modify,
  [DELETION]: ChangeKind.Delete,
}

export type FixtureSize = 'small' | 'medium' | 'large'

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

const DEFAULT_ROOT = 'force-app/main/default'

const generateDiffLines = (config: SizeConfig, root: string): string[] => {
  const lines: string[] = []

  for (let i = 0; i < config.classes; i++) {
    const changeType =
      i % 3 === 0 ? ADDITION : i % 3 === 1 ? MODIFICATION : DELETION
    lines.push(`${changeType}\t${root}/classes/MyClass${pad(i)}.cls`)
    lines.push(`${changeType}\t${root}/classes/MyClass${pad(i)}.cls-meta.xml`)
  }

  for (let i = 0; i < config.triggers; i++) {
    lines.push(`${ADDITION}\t${root}/triggers/MyTrigger${pad(i)}.trigger`)
    lines.push(
      `${ADDITION}\t${root}/triggers/MyTrigger${pad(i)}.trigger-meta.xml`
    )
  }

  for (let i = 0; i < config.lwcComponents; i++) {
    lines.push(
      `${MODIFICATION}\t${root}/lwc/myComponent${pad(i)}/myComponent${pad(i)}.js`
    )
    lines.push(
      `${MODIFICATION}\t${root}/lwc/myComponent${pad(i)}/myComponent${pad(i)}.html`
    )
    lines.push(
      `${MODIFICATION}\t${root}/lwc/myComponent${pad(i)}/myComponent${pad(i)}.js-meta.xml`
    )
  }

  for (let i = 0; i < config.customObjects; i++) {
    lines.push(
      `${MODIFICATION}\t${root}/objects/CustomObj${pad(i)}__c/CustomObj${pad(i)}__c.object-meta.xml`
    )
    lines.push(
      `${ADDITION}\t${root}/objects/CustomObj${pad(i)}__c/fields/NewField__c.field-meta.xml`
    )
  }

  for (let i = 0; i < config.profiles; i++) {
    lines.push(
      `${MODIFICATION}\t${root}/profiles/Admin${pad(i)}.profile-meta.xml`
    )
  }

  return lines
}

export const generateDiffFixtures = (
  size: FixtureSize
): { readonly lines: string[] } => ({
  lines: generateDiffLines(SIZE_CONFIGS[size], DEFAULT_ROOT),
})

export type DiffLineSource = () => readonly string[]

// Wide enough that the counter never outgrows its padding over a whole
// benchmark run, so every generated line keeps a constant length across
// samples (mirrors cancellationKey.bench.ts's ROUND_COUNTER_PAD).
const ROUND_COUNTER_PAD = 7

// Distinct content every call: a `round<N>` directory segment rides between
// `force-app/` and `main/`, so every line is a registry miss on any
// registry and the round counter never matches a registry directory name.
export const createDistinctRoundLines = (size: FixtureSize): DiffLineSource => {
  let round = 0
  return (): readonly string[] => {
    round += 1
    const n = String(round).padStart(ROUND_COUNTER_PAD, '0')
    return generateDiffLines(
      SIZE_CONFIGS[size],
      `force-app/round${n}/main/default`
    )
  }
}

// Same content every call, new string objects every call: what a second sgd
// run over the same paths pays — the Map lookup must hash a string V8 has
// never seen, instead of reading a hash cached on a reused object.
export const createSameContentLines = (size: FixtureSize): DiffLineSource => {
  return (): readonly string[] =>
    generateDiffLines(SIZE_CONFIGS[size], DEFAULT_ROOT)
}

export const generateManifestElements = (
  size: FixtureSize
): readonly ManifestElement[] => {
  const config = SIZE_CONFIGS[size]
  const manifests: ManifestElement[] = []

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

  return manifests
}
