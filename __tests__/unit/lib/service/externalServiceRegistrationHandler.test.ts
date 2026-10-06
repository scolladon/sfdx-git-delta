'use strict'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { MetadataRepository } from '../../../../src/metadata/MetadataRepository'
import { getDefinition } from '../../../../src/metadata/metadataManager'
import ExternalServiceRegistrationHandler from '../../../../src/service/externalServiceRegistrationHandler'
import type { Config } from '../../../../src/types/config'
import {
  ChangeKind,
  CopyOperationKind,
  emptyResult,
  ManifestTarget,
} from '../../../../src/types/handlerResult'
import { pathExists } from '../../../../src/utils/fsHelper'
import { elementsOf } from '../../../__utils__/handlerResultView'
import { createElement } from '../../../__utils__/testElement'
import { getConfig, getContext } from '../../../__utils__/testWork'

vi.mock('../../../../src/utils/fsHelper')
vi.mock('../../../../src/utils/LoggingService')

const mockedPathExists = vi.mocked(pathExists)

const DIR = 'force-app/main/default/externalServiceRegistrations'
const DEFINITION = `${DIR}/Svc.externalServiceRegistration-meta.xml`
const SCHEMA = `${DIR}/Svc.yaml`
const REVISION = 'sha-to'
const TYPE = 'ExternalServiceRegistration'

const gitCopy = (path: string) => ({
  kind: CopyOperationKind.GitCopy,
  path,
  revision: REVISION,
})

let globalMetadata: MetadataRepository
beforeAll(async () => {
  globalMetadata = await getDefinition({})
})

let config: Config
beforeEach(() => {
  vi.clearAllMocks()
  config = getConfig()
  config.generateDelta = true
  config.to = REVISION
})

const buildSut = (line: string) => {
  const ctx = getContext({ config })
  const { changeType, element } = createElement(
    line,
    globalMetadata.get('externalServiceRegistrations')!,
    globalMetadata
  )
  const sut = new ExternalServiceRegistrationHandler(changeType, element, ctx)
  return { sut, ctx }
}

describe('Given a schema yaml', () => {
  it.each([
    ['A', ChangeKind.Add],
    ['M', ChangeKind.Modify],
  ])(
    'When %s, Then it is packaged as the registration',
    async (status, changeKind) => {
      // Arrange
      mockedPathExists.mockResolvedValue(false)
      const { sut } = buildSut(`${status}       ${SCHEMA}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(elementsOf(result)).toEqual([
        {
          target: ManifestTarget.Package,
          type: TYPE,
          member: 'Svc',
          changeKind,
        },
      ])
      expect(result.warnings).toEqual([])
    }
  )

  it('When getElementDescriptor, Then it names the registration', () => {
    // Arrange
    const { sut } = buildSut(`A       ${SCHEMA}`)

    // Act
    const result = sut.getElementDescriptor()

    // Assert
    expect(result).toEqual({ type: TYPE, member: 'Svc' })
  })
})

describe('Given a file of another extension in the type directory', () => {
  it.each(['Svc.json', 'README.md'])(
    'When %s, Then nothing is collected',
    async file => {
      // Arrange
      const { sut } = buildSut(`A       ${DIR}/${file}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result).toEqual(emptyResult())
    }
  )
})

describe.each([
  ['schema', SCHEMA, DEFINITION],
  ['definition', DEFINITION, SCHEMA],
])('Given a changed %s file', (_label, changed, sibling) => {
  describe.each(['A', 'M'])('When %s', status => {
    it('And the sibling exists, Then both files are copied', async () => {
      // Arrange
      mockedPathExists.mockResolvedValue(true)
      const { sut, ctx } = buildSut(`${status}       ${changed}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies).toEqual([gitCopy(changed), gitCopy(sibling)])
      expect(mockedPathExists).toHaveBeenCalledExactlyOnceWith(sibling, ctx)
    })

    it('And the sibling is absent, Then only the changed file is copied', async () => {
      // Arrange
      mockedPathExists.mockResolvedValue(false)
      const { sut } = buildSut(`${status}       ${changed}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies).toEqual([gitCopy(changed)])
      expect(result.warnings).toEqual([])
    })

    it('And generateDelta is false, Then nothing is copied nor probed', async () => {
      // Arrange
      config.generateDelta = false
      const { sut } = buildSut(`${status}       ${changed}`)

      // Act
      const result = await sut.collect()

      // Assert
      expect(result.copies).toEqual([])
      expect(mockedPathExists).not.toHaveBeenCalled()
    })
  })
})

describe('Given a deleted schema', () => {
  it('When the definition is live, Then the registration is redeployed with the definition', async () => {
    // Arrange
    mockedPathExists.mockResolvedValue(true)
    const { sut, ctx } = buildSut(`D       ${SCHEMA}`)

    // Act
    const result = await sut.collect()

    // Assert
    expect(result.elements).toEqual([
      {
        target: ManifestTarget.Package,
        type: TYPE,
        member: 'Svc',
        changeKind: ChangeKind.Delete,
      },
    ])
    expect(result.copies).toEqual([gitCopy(DEFINITION)])
    expect(result.warnings).toEqual([])
    expect(mockedPathExists).toHaveBeenCalledWith(DEFINITION, ctx)
  })

  it('When the definition is live and generateDelta is false, Then it is still redeployed without copies', async () => {
    // Arrange
    config.generateDelta = false
    mockedPathExists.mockResolvedValue(true)
    const { sut, ctx } = buildSut(`D       ${SCHEMA}`)

    // Act
    const result = await sut.collect()

    // Assert
    expect(elementsOf(result)).toEqual([
      {
        target: ManifestTarget.Package,
        type: TYPE,
        member: 'Svc',
        changeKind: ChangeKind.Delete,
      },
    ])
    expect(result.copies).toEqual([])
    expect(mockedPathExists).toHaveBeenCalledWith(DEFINITION, ctx)
  })

  it('When the definition is absent, Then the registration is destructive', async () => {
    // Arrange
    mockedPathExists.mockResolvedValue(false)
    const { sut } = buildSut(`D       ${SCHEMA}`)

    // Act
    const result = await sut.collect()

    // Assert
    expect(elementsOf(result)).toEqual([
      {
        target: ManifestTarget.DestructiveChanges,
        type: TYPE,
        member: 'Svc',
        changeKind: ChangeKind.Delete,
      },
    ])
    expect(result.copies).toEqual([])
  })
})

describe('Given a deleted definition', () => {
  it('When collect, Then the registration is destructive', async () => {
    // Arrange
    mockedPathExists.mockResolvedValue(false)
    const { sut } = buildSut(`D       ${DEFINITION}`)

    // Act
    const result = await sut.collect()

    // Assert
    expect(elementsOf(result)).toEqual([
      {
        target: ManifestTarget.DestructiveChanges,
        type: TYPE,
        member: 'Svc',
        changeKind: ChangeKind.Delete,
      },
    ])
    expect(result.copies).toEqual([])
  })
})
