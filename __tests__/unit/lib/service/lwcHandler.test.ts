'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ADDITION,
  DELETION,
  MODIFICATION,
} from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import LwcHandler from '../../../../src/service/lwcHandler'
import type { Config } from '../../../../src/types/config'
import {
  CopyOperationKind,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { pathExists } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')

const objectType = {
  directoryName: 'lwc',
  inFolder: false,
  metaFile: false,
  xmlName: 'LightningComponentBundle',
}
const element = 'component'
const basePath = `force-app/main/default/${objectType.directoryName}`
const entityPath = `${basePath}/${element}/${element}.js`
const xmlName = 'LightningComponentBundle'
const TO = 'to-revision'
const mockedPathExists = vi.mocked(pathExists)
let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
})

describe('lwcHandler', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })
  describe('when the line should not be processed', () => {
    it.each([`${basePath}/.eslintrc.json`, `${basePath}/jsconfig.json`])(
      'does not handle the line',
      async entityPath => {
        // Arrange
        const { changeType, element: el } = createElement(
          `${ADDITION}       ${entityPath}`,
          objectType,
          globalMetadata
        )
        const sut = new LwcHandler(changeType, el, getContext({ config }))

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual([])
        expect(result.copies).toEqual([])
      }
    )
  })

  describe('when the line should be processed', () => {
    it.each([ADDITION, MODIFICATION])(
      'handles the line for "%s" type change',
      async changeType => {
        // Arrange
        const { changeType: ct, element: el } = createElement(
          `${changeType}       ${entityPath}`,
          objectType,
          globalMetadata
        )
        const sut = new LwcHandler(ct, el, getContext({ config }))

        // Act
        const result = await sut.collect()

        // Assert
        expect(elementsOf(result)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              target: ManifestTarget.Package,
              type: xmlName,
              member: element,
            }),
          ])
        )
      }
    )

    it('handles the line for "D" type change', async () => {
      // Arrange
      const { changeType, element: el } = createElement(
        `${DELETION}       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new LwcHandler(changeType, el, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            target: ManifestTarget.DestructiveChanges,
            type: xmlName,
            member: element,
          }),
        ])
      )
      expect(result.copies).toEqual([])
    })
  })

  describe('Given generateDelta', () => {
    const DEFAULT_ROOT = 'force-app/main/default'
    const companionRequests = (copies: readonly { kind: string }[]) =>
      copies.filter(
        op =>
          op.kind === CopyOperationKind.GitComponentCopy ||
          op.kind === CopyOperationKind.GitTypeDirCompanionCopy
      )

    type Bundle = [
      type: string,
      line: string,
      bundleDir: string,
      typeDir: string,
    ]
    type Row = [...Bundle, changeType: string]
    const bundles: Bundle[] = [
      [
        'LightningComponentBundle',
        `${DEFAULT_ROOT}/lwc/cmp/cmp.js`,
        `${DEFAULT_ROOT}/lwc/cmp`,
        `${DEFAULT_ROOT}/lwc`,
      ],
      [
        'AuraDefinitionBundle',
        `${DEFAULT_ROOT}/aura/cmp/cmp.cmp`,
        `${DEFAULT_ROOT}/aura/cmp`,
        `${DEFAULT_ROOT}/aura`,
      ],
      [
        'GenAiFunction',
        `${DEFAULT_ROOT}/genAiFunctions/fn/input.json`,
        `${DEFAULT_ROOT}/genAiFunctions/fn`,
        `${DEFAULT_ROOT}/genAiFunctions`,
      ],
    ]
    const rows: Row[] = bundles.flatMap(([type, line, bundleDir, typeDir]) =>
      [ADDITION, MODIFICATION].map(
        (changeType): Row => [type, line, bundleDir, typeDir, changeType]
      )
    )

    it.each(rows)(
      'When a "%s" line %s is collected, Then it requests bundle %s and companions of %s (%s)',
      async (type, line, bundleDir, typeDir, changeType) => {
        // Arrange
        config.to = TO
        const { changeType: ct, element: el } = createElement(
          `${changeType}       ${line}`,
          globalMetadata.getByXmlName(type)!,
          globalMetadata
        )
        const sut = new LwcHandler(ct, el, getContext({ config }))

        // Act
        const result = await sut.collect()

        // Assert
        expect(companionRequests(result.copies)).toEqual([
          {
            kind: CopyOperationKind.GitComponentCopy,
            path: bundleDir,
            revision: TO,
          },
          {
            kind: CopyOperationKind.GitTypeDirCompanionCopy,
            path: typeDir,
            revision: TO,
          },
        ])
      }
    )

    it('When generateDelta is false, Then no companion request is produced', async () => {
      // Arrange
      config.generateDelta = false
      const { changeType, element: el } = createElement(
        `${ADDITION}       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new LwcHandler(changeType, el, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies).toEqual([])
    })

    it('When a deletion leaves the component at --to, Then both requests are produced', async () => {
      // Arrange
      config.to = TO
      mockedPathExists.mockResolvedValue(true)
      const { changeType, element: el } = createElement(
        `${DELETION}       ${entityPath}`,
        objectType,
        globalMetadata
      )
      const sut = new LwcHandler(changeType, el, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(companionRequests(result.copies)).toEqual([
        {
          kind: CopyOperationKind.GitComponentCopy,
          path: `${basePath}/${element}`,
          revision: TO,
        },
        {
          kind: CopyOperationKind.GitTypeDirCompanionCopy,
          path: basePath,
          revision: TO,
        },
      ])
    })
  })
})
