'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTreeReader } from '../../../../src/adapter/treeReader'
import { ADDITION } from '../../../../src/constant/gitConstants'
import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ContainedDecomposedHandler from '../../../../src/service/containedDecomposedHandler'
import DecomposedHandler from '../../../../src/service/decomposedHandler'
import InFileHandler from '../../../../src/service/inFileHandler'
import InFolderHandler from '../../../../src/service/inFolderHandler'
import InResourceHandler from '../../../../src/service/inResourceHandler'
import SharedFolderHandler from '../../../../src/service/sharedFolderHandler'
import StandardHandler from '../../../../src/service/standardHandler'
import type { Config } from '../../../../src/types/config'
import type { RunContext } from '../../../../src/types/runContext'
import ChangeSet from '../../../../src/utils/changeSet'
import { readDirs } from '../../../../src/utils/fsHelper'
import { createElement } from '../../../__utils__/testElement'
import { createMetadataRepositoryMock } from '../../../__utils__/testMetadataRepository'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
const mockedReadDirs = vi.mocked(readDirs)

const { mockMetadataDiffRun } = vi.hoisted(() => ({
  mockMetadataDiffRun: vi.fn(),
}))
vi.mock('../../../../src/utils/metadataDiff', () => ({
  default: vi.fn().mockImplementation(function () {
    return { run: mockMetadataDiffRun }
  }),
}))

const classType = {
  directoryName: 'classes',
  inFolder: false,
  metaFile: true,
  suffix: 'cls',
  xmlName: 'ApexClass',
}
const basePath = 'force-app/main/default/'
const entityPath = (name: string) =>
  `${basePath}${classType.directoryName}/${name}.${classType.suffix}`

const workflowType = {
  childXmlNames: ['WorkflowAlert'],
  directoryName: 'workflows',
  inFolder: false,
  metaFile: false,
  suffix: 'workflow',
  xmlName: 'Workflow',
}

const staticResourceType = {
  directoryName: 'staticresources',
  inFolder: false,
  metaFile: true,
  suffix: 'resource',
  xmlName: 'StaticResource',
}

const documentType = {
  directoryName: 'documents',
  inFolder: true,
  metaFile: true,
  suffix: 'document',
  xmlName: 'Document',
}

const discoveryType = {
  directoryName: 'discovery',
  inFolder: false,
  metaFile: true,
  content: [{ suffix: 'model', xmlName: 'DiscoveryAIModel' }],
}

const recordTypeWithParent = {
  directoryName: 'recordTypes',
  inFolder: false,
  metaFile: false,
  suffix: 'recordType',
  xmlName: 'RecordType',
  parentXmlName: 'CustomObject',
}

type Family = {
  name: string
  build: (
    ctx: RunContext,
    globalMetadata: MetadataRepository
  ) => StandardHandler
}

const families: Family[] = [
  {
    name: 'StandardHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        `${ADDITION}       ${entityPath('MyClass')}`,
        classType,
        globalMetadata
      )
      return new StandardHandler(changeType, Object.freeze(element), ctx)
    },
  },
  {
    name: 'InFileHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        'A       force-app/main/default/workflows/Account.workflow-meta.xml',
        workflowType,
        globalMetadata
      )
      return new InFileHandler(changeType, Object.freeze(element), ctx)
    },
  },
  {
    name: 'InResourceHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        'A       force-app/main/default/staticresources/myResource.resource',
        staticResourceType,
        globalMetadata
      )
      return new InResourceHandler(changeType, Object.freeze(element), ctx)
    },
  },
  {
    name: 'InFolderHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        'A       force-app/main/default/documents/folder/test.document-meta.xml',
        documentType,
        globalMetadata
      )
      return new InFolderHandler(changeType, Object.freeze(element), ctx)
    },
  },
  {
    name: 'SharedFolderHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        'A       force-app/main/default/discovery/DiscoveryAIModelTest.model',
        discoveryType,
        globalMetadata
      )
      return new SharedFolderHandler(changeType, Object.freeze(element), ctx)
    },
  },
  {
    name: 'DecomposedHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        'A       force-app/main/default/objects/Account/recordTypes/Test.recordType-meta.xml',
        recordTypeWithParent,
        globalMetadata
      )
      return new DecomposedHandler(changeType, Object.freeze(element), ctx)
    },
  },
  {
    name: 'ContainedDecomposedHandler',
    build: (ctx, globalMetadata) => {
      const { changeType, element } = createElement(
        'A       force-app/main/permissionsets/Subject.permissionset-meta.xml',
        globalMetadata.get('permissionsets')!,
        globalMetadata
      )
      return new ContainedDecomposedHandler(
        changeType,
        Object.freeze(element),
        ctx
      )
    },
  },
]

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
  mockedReadDirs.mockResolvedValue([])
  mockMetadataDiffRun.mockResolvedValue({
    manifests: { added: [], modified: [], deleted: [] },
    hasPackageContent: false,
  })
})

describe('handler purity', () => {
  let globalMetadata: MetadataRepository
  beforeAll(async () => {
    globalMetadata = await getDefinition({})
  })

  // Object.freeze is shallow, so freezing the context alone would leave
  // config.source (an array), the metadata repository and the reader
  // writable — and the fixture's default reader is a module singleton
  // shared with every other suite in this worker, where a stray write would
  // silently corrupt them instead of throwing. Freeze every field the
  // handler can reach, and hand over a reader of this test's own so nothing
  // shared is frozen as a side effect.
  const freezeInputs = (): RunContext => {
    const frozenConfig = getConfig()
    Object.freeze(frozenConfig.source)
    return Object.freeze(
      getContext({
        config: Object.freeze(frozenConfig),
        metadata: Object.freeze(createMetadataRepositoryMock()),
        trees: Object.freeze(createTreeReader(new Map())),
      })
    )
  }

  describe('frozen inputs', () => {
    it.each(families.map(f => [f.name, f.build] as const))(
      'Given a frozen RunContext, its frozen Config and source paths, and a frozen element, When %s.collect runs, Then it resolves with no warnings instead of writing to a frozen input',
      async (_name, build) => {
        // Arrange — ESM modules are strict mode, so any write a handler
        // makes to a frozen input throws TypeError. `collect()` never
        // rejects (its own catch absorbs any throw into `warnings`), so
        // the meaningful assertion is an empty warnings axis: a caught
        // write-to-frozen-input would surface there instead of silently
        // vanishing behind a bare "resolves" check.
        const frozenCtx = freezeInputs()
        const sut = build(frozenCtx, globalMetadata)

        // Act
        const result = await sut.collect()

        // Assert — the processability anchor matters: collect() returns an
        // empty result without doing any work when _isProcessable() is false,
        // so without it this passes whether or not the frozen inputs were
        // ever touched.
        expect(sut['_isProcessable']()).toBe(true)
        expect(result.warnings).toEqual([])
      }
    )
  })

  describe('referential transparency', () => {
    it('Given the same handler, When collect is called twice, Then both calls resolve to deep-equal results built from distinct array instances', async () => {
      // Arrange
      config.to = 'sha123'
      const line = `${ADDITION}       ${entityPath('MyClass')}`
      const { changeType, element } = createElement(
        line,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(
        changeType,
        element,
        getContext({ config })
      )

      // Act
      const first = await sut.collect()
      const second = await sut.collect()

      // Assert — anchored on real output, since two empty results would
      // satisfy both of the following without proving anything.
      expect(first.elements).not.toHaveLength(0)
      expect(second).toEqual(first)
      expect(second.elements).not.toBe(first.elements)
    })
  })

  describe('isolation', () => {
    it('Given two handlers built from the same Config over different elements, When both collect, Then each result is an independent axis triple unaffected by the other', async () => {
      // Arrange — a shared Config instance is safe to reuse (it is never
      // written to); each handler still owns its own result axes.
      const { changeType: changeTypeA, element: elementA } = createElement(
        `${ADDITION}       ${entityPath('ClassA')}`,
        classType,
        globalMetadata
      )
      const { changeType: changeTypeB, element: elementB } = createElement(
        `${ADDITION}       ${entityPath('ClassB')}`,
        classType,
        globalMetadata
      )
      const handlerA = new StandardHandler(
        changeTypeA,
        elementA,
        getContext({ config })
      )
      const handlerB = new StandardHandler(
        changeTypeB,
        elementB,
        getContext({ config })
      )

      // Act
      const resultA = await handlerA.collect()
      const resultB = await handlerB.collect()

      // Assert — readonly axes make identity the correct isolation check:
      // neither handler could have written into the other's arrays.
      expect(resultA.elements).not.toBe(resultB.elements)
      expect(resultA.copies).not.toBe(resultB.copies)
      expect(resultA.warnings).not.toBe(resultB.warnings)
      expect(ChangeSet.from([...resultA.elements]).toElements()).toEqual([
        {
          target: resultA.elements[0]!.target,
          type: resultA.elements[0]!.type,
          member: 'ClassA',
          changeKind: resultA.elements[0]!.changeKind,
        },
      ])
    })
  })

  describe('error transactionality', () => {
    it('Given metadataDiff.run rejects inside an InFileHandler, When collect runs, Then the result is exactly one wrapped warning with empty elements and copies', async () => {
      // Arrange — strengthens today's behaviour: the only reachable throw
      // sites (metadataDiff.run, isPackable) fire before any write, so no
      // fixture ever depended on partial-write survival.
      mockMetadataDiffRun.mockRejectedValueOnce(new Error('malformed xml'))
      const { changeType, element } = createElement(
        'A       force-app/main/default/workflows/Account.workflow-meta.xml',
        workflowType,
        globalMetadata
      )
      const sut = new InFileHandler(changeType, element, getContext({ config }))

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.elements).toEqual([])
      expect(result.copies).toEqual([])
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].cause).toBeInstanceOf(Error)
    })

    it('Given a StandardHandler whose collectAddition throws, When collect runs, Then the result is exactly one wrapped warning with empty elements and copies', async () => {
      // Arrange
      const { changeType, element } = createElement(
        `${ADDITION}       ${entityPath('MyClass')}`,
        classType,
        globalMetadata
      )
      const sut = new StandardHandler(
        changeType,
        element,
        getContext({ config })
      )
      vi.spyOn(sut, 'collectAddition').mockRejectedValueOnce(new Error('boom'))

      // Act
      const result = await sut.collect()

      // Assert
      expect(result).toEqual({
        elements: [],
        copies: [],
        warnings: [expect.any(Error)],
      })
      expect(result.warnings[0].message).toContain('boom')
    })
  })
})
